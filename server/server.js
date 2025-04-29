const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const config = require('./config');
const { addPlayer, removePlayer, getAllPlayers, updatePlayerPosition, setPlayerName, players } = require('./utils/players');
const { initInventory, getInventory, moveItem, dropItem: invDrop, pickupItem } = require('./utils/inventory');
const { addDrop, removeDrop, getDropById, getDropsInMap } = require('./utils/drops');
const { isReachableWithin, hasLineOfSightServer } = require('./utils/pathfinding');
const { loadMap, startMapId, getTeleporters } = require('./utils/maps');
const mapsConfig = require('./maps.json'); // Assuming maps.json contains map configurations

// Store players, items, and spells by map
// Delay before applying teleporter effect to sync with client animation (ms)
const TELEPORT_DELAY = 200;
// In-memory state per map: players, items, spells
const mapsState = {};
// Leveling and XP progression
const MAX_LEVEL = 100;
// XP required to go from level L to L+1
const xpToNext = new Array(MAX_LEVEL + 1).fill(0);
// Linear progression: 100 * L for L<99, and sum of previous for L=99
let xpSum = 0;
for (let L = 1; L <= MAX_LEVEL; L++) {
  if (L < 99) {
    xpToNext[L] = 100 * L;
    xpSum += xpToNext[L];
  } else if (L === 99) {
    xpToNext[L] = xpSum;
    xpSum += xpToNext[L];
  } else {
    xpToNext[L] = 0;
  }
}

/**
 * Get stats object for a player to send to client
 * @param {object} p
 */
function getStats(p) {
  return {
    life: p.life,
    mana: p.mana,
    xp: p.xp,
    level: p.level,
    xpToNext: xpToNext[p.level] || 0
  };
}
// Buff spell duration (ms)
const SPELL_BUFF_DURATION = 10000;

/**
 * Initialize a map's state.
 * @param {string} mapId
 */
function initializeMapState(mapId) {
    if (!mapsState[mapId]) {
        mapsState[mapId] = {
            players: {}, // Players in this map
            items: {},   // Items dropped in this map
            spells: []   // Active spells in this map
        };
    }
}

// Initialize all maps from maps.json
Object.keys(mapsConfig.maps).forEach(mapId => initializeMapState(mapId));

// Load the initial game map once at startup
const mapData = loadMap(startMapId);
// Place 3 random items on the starting map
const initialItems = [
  { itemType: 'apple', quantity: 3 },
  { itemType: 'stone', quantity: 5 },
  { itemType: 'potion', quantity: 1 }
];
initialItems.forEach((item, idx) => {
  const xTile = Math.floor(Math.random() * mapData.cols);
  const yTile = Math.floor(Math.random() * mapData.rows);
  const x = xTile * config.TILE_SIZE;
  const y = yTile * config.TILE_SIZE;
  const dropId = Date.now() + idx;
  // Add to mapsState for the starting map
  mapsState[startMapId].items[dropId] = {
    id: dropId,
    playerId: null,
    itemType: item.itemType,
    quantity: item.quantity,
    x,
    y
  };
});

// Express setup to serve the client
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);
    // Initialize and send inventory
    initInventory(socket.id);
    socket.emit('currentInventory', getInventory(socket.id));

    // Handle player joining a map
    const player = addPlayer(socket.id, startMapId); // Utiliser startMapId
    const mapState = mapsState[player.mapId];
    mapState.players[socket.id] = player;

    socket.join(player.mapId);
    socket.emit('mapData', loadMap(player.mapId));
    socket.emit('currentPlayers', Object.values(mapState.players));
    socket.emit('currentDrops', Object.values(mapState.items));
    // Send initial stats to this client
    socket.emit('statsUpdate', { id: socket.id, stats: getStats(player) });
    // Send current active spells for this map
    Object.values(mapsState[player.mapId].spells).forEach(sp => {
        socket.emit('spellCast', sp);
    });

    // Notify other players in the map
    socket.to(player.mapId).emit('newPlayer', player);

    // Handle client setting their name
    socket.on('setName', ({ name }) => {
        setPlayerName(socket.id, name);
        // Notify all clients of the name update
        io.emit('playerName', { id: socket.id, name });
    });

    // Handle dropping an item onto the map
    socket.on('dropItem', ({ slot, x, y }) => {
        const p = players[socket.id];
        if (!p || p.dead) return;  // dead players cannot drop
        // Remove item from player's inventory
        const inv = getInventory(socket.id);
        if (!Array.isArray(inv) || slot < 0 || slot >= inv.length) return;
        const item = inv[slot];
        if (!item) return;
        inv[slot] = null;
        // Create drop record
        const room = player.mapId;
        const dropId = Date.now();
        const dropRecord = {
            id: dropId,
            playerId: socket.id,
            itemType: item.type,
            quantity: item.quantity,
            x,
            y
        };
        // Add to map state and notify clients
        mapsState[room].items[dropId] = dropRecord;
        io.to(room).emit('itemDropped', dropRecord);
        // Update inventory UI for this player
        socket.emit('inventoryUpdated', getInventory(socket.id));
    });

    // Handle picking up an item
    socket.on('pickupItem', ({ id }) => {
        const p = players[socket.id];
        if (!p || p.dead) return;  // dead players cannot pickup
        const room = player.mapId;
        const item = mapsState[room].items[id];
        if (item && pickupItem(socket.id, id, () => item)) {
            delete mapsState[room].items[id];
            io.to(room).emit('itemPicked', { playerId: socket.id, dropId: id });
            socket.emit('inventoryUpdated', getInventory(socket.id));
        }
    });

    // Handle movement requests from client
    socket.on('moveTo', ({ x, y, seq, isLast }) => {
        const p = players[socket.id];
        if (!p || p.dead) return;  // dead players cannot move
        // Validate input
        if (typeof x !== 'number' || typeof y !== 'number') return;
        // Bounds check
        if (
            x < 0 || y < 0 ||
            x > config.WORLD_WIDTH - config.TILE_SIZE ||
            y > config.WORLD_HEIGHT - config.TILE_SIZE
        ) return;
        // Enforce tile alignment
        if (x % config.TILE_SIZE !== 0 || y % config.TILE_SIZE !== 0) return;
        // Block movement on impassable tiles (water=1, tree=2)
        const tileX = x / config.TILE_SIZE;
        const tileY = y / config.TILE_SIZE;
        const tileType = mapData.tiles[tileY] && mapData.tiles[tileY][tileX];
        if (tileType === 1 || tileType === 2) return;
        // Update position
        updatePlayerPosition(socket.id, x, y);
        // Broadcast movement to clients in the same map
        const room = player.mapId;
        io.to(room).emit('playerMoved', { id: socket.id, x, y, seq, mapId: room });
        // Only pick up items when this move is the final step (delayed to match client animation)
        if (isLast) {
            Object.entries(mapsState[room].items).forEach(([dropIdStr, drop]) => {
                const dropId = parseInt(dropIdStr, 10);
                if (drop.x === x && drop.y === y) {
                    setTimeout(() => {
                        // Ensure drop still exists (prevent duplicate pickups)
                        if (!mapsState[room].items[dropId]) return;
                        // Attempt to pick up via inventory util
                        if (pickupItem(socket.id, dropId, () => drop)) {
                            // Remove from map state
                            delete mapsState[room].items[dropId];
                            // Notify clients to remove drop marker
                            io.to(room).emit('itemPicked', { dropId });
                            // Update inventory on this client
                            socket.emit('inventoryUpdated', getInventory(socket.id));
                        }
                    }, TELEPORT_DELAY);
                }
            });
        }

        // Handle spell1 orb collision and teleport effect on final step (delayed to match client animation)
        if (isLast) {
            Object.entries(mapsState[room].spells).forEach(([orbIdStr, orb]) => {
                const orbId = parseInt(orbIdStr, 10);
                if (orb.spellId === 1 && orb.x === x && orb.y === y) {
                    const victim = players[socket.id];
                    // Apply damage
                    if (victim && !victim.dead) {
                        victim.life = Math.max(0, victim.life - 10);
                        // Broadcast updated stats only to the victim
                        socket.emit('statsUpdate', { id: socket.id, stats: getStats(victim) });
                        if (victim.life <= 0) {
                            victim.dead = true;
                            // Notify all clients of death
                            io.to(room).emit('playerDied', { id: socket.id });
                        }
                        // If still alive, teleport
                        if (!victim.dead) {
                            // Remove orb
                            delete mapsState[room].spells[orbId];
                            io.to(room).emit('spellExpired', { id: orbId });
                            // Teleport to adjacent valid tile
                            const tileX = x / config.TILE_SIZE;
                            const tileY = y / config.TILE_SIZE;
                            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
                            for (const [dx, dy] of dirs) {
                                const nx = tileX + dx;
                                const ny = tileY + dy;
                                // Bounds and passable check
                                if (nx >= 0 && ny >= 0 && ny < mapData.rows && nx < mapData.cols) {
                                    const type = mapData.tiles[ny][nx];
                                    if (type !== 1 && type !== 2) {
                                        const newX = nx * config.TILE_SIZE;
                                        const newY = ny * config.TILE_SIZE;
                                        updatePlayerPosition(socket.id, newX, newY);
                                        io.to(room).emit('playerTeleported', { id: socket.id, x: newX, y: newY });
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
        // Handle teleporters on final step (delayed to match client movement animation)
        if (isLast) {
            const tp = getTeleporters(room).find(t => t.x === x / config.TILE_SIZE && t.y === y / config.TILE_SIZE);
            if (tp) {
                setTimeout(() => {
                    // Remove player from current map
                    delete mapsState[room].players[socket.id];
                    socket.leave(room);
                    socket.to(room).emit('playerRemoved', socket.id);

                    // Add player to new map
                    player.mapId = tp.toMap;
                    player.x = tp.toX * config.TILE_SIZE;
                    player.y = tp.toY * config.TILE_SIZE;
                    initializeMapState(tp.toMap);
                    mapsState[tp.toMap].players[socket.id] = player;

                    socket.join(tp.toMap);
                socket.emit('changeMap', {
                    mapData: loadMap(tp.toMap),
                    players: Object.values(mapsState[tp.toMap].players),
                    drops: Object.values(mapsState[tp.toMap].items)
                });
                // Send existing orbs on new map to this player
                Object.values(mapsState[tp.toMap].spells).forEach(sp => {
                    socket.emit('spellCast', sp);
                });
                    socket.to(tp.toMap).emit('newPlayer', player);
                }, TELEPORT_DELAY);
            }
        }
    });

    // Handle spell casting from client
    socket.on('castSpell', ({ spellId, x, y }) => {
        const p = players[socket.id];
        if (!p || p.dead) return;  // dead players cannot cast
        if (spellId === 1) {
            // Determine tile coords
            const px = players[socket.id].x;
            const py = players[socket.id].y;
            const start = { x: Math.floor(px / config.TILE_SIZE), y: Math.floor(py / config.TILE_SIZE) };
            const tx = Math.floor(x / config.TILE_SIZE);
            const ty = Math.floor(y / config.TILE_SIZE);
            const goal = { x: tx, y: ty };
            // Range check (Manhattan)
            if (!isReachableWithin(start, goal, mapData.tiles, 4)) return;
            // LOS check
            if (!hasLineOfSightServer(start, goal, mapData.tiles)) return;
            // Tile passable check
            const tileType = mapData.tiles[ty] && mapData.tiles[ty][tx];
            if (tileType === 1 || tileType === 2) return;
            const p = players[socket.id];
            // Mana cost
            if (p.mana < 5) return;
            p.mana -= 5;
            // Send updated stats
            socket.emit('statsUpdate', { id: socket.id, stats: getStats(p) });
            const room = p.mapId;
            // Spawn server-authoritative orb
            const orbId = Date.now() + Math.floor(Math.random() * 1000);
            const startTime = Date.now();
            const sp = { id: orbId, caster: socket.id, spellId: 1, x, y, start: startTime, duration: 5000 };
            mapsState[room].spells[orbId] = sp;
            // Broadcast spawn to clients
            io.to(room).emit('spellCast', sp);
            // Schedule expiration
            setTimeout(() => {
                if (mapsState[room].spells[orbId]) {
                    delete mapsState[room].spells[orbId];
                    io.to(room).emit('spellExpired', { id: orbId });
                }
            }, sp.duration);
        } else if (spellId === 2) {
            // Buff size: apply to caster and persist server-side
            const p = players[socket.id];
            if (!p) return;
            // Mana cost
            if (p.mana < 8) return;
            p.mana -= 8;
            // Send updated stats
            socket.emit('statsUpdate', { id: socket.id, stats: getStats(p) });
            const room = p.mapId;
            // Compute buff end timestamp and store on player
            const buffEnd = Date.now() + SPELL_BUFF_DURATION;
            p.buffEnd = buffEnd;
            // Broadcast buff event with caster position
            io.to(room).emit('spellCast', { id: socket.id, spellId: 2, x: p.x, y: p.y });
        }
    });

    // Handle inventory reordering (client UI)
    socket.on('moveItem', ({ from, to }) => {
        const p = players[socket.id];
        if (!p || p.dead) return;  // dead players cannot reorder
        if (moveItem(socket.id, from, to)) {
            socket.emit('inventoryUpdated', getInventory(socket.id));
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const room = player.mapId;
        delete mapsState[room].players[socket.id];
        socket.to(room).emit('playerDisconnected', socket.id);
        console.log('Client déconnecté:', socket.id);
    });
});

// Regenerate stats periodically (server-authoritative)
// Life regen: +1 every 2 seconds
setInterval(() => {
    Object.values(players).forEach(p => {
        const oldLife = p.life;
        p.life = Math.min(100, p.life + 1);
        if (p.life !== oldLife) {
            io.to(p.id).emit('statsUpdate', { id: p.id, stats: getStats(p) });
        }
    });
}, 2000);
// Mana regen: +2 every 1 second
setInterval(() => {
    Object.values(players).forEach(p => {
        const oldMana = p.mana;
        p.mana = Math.min(50, p.mana + 2);
        if (p.mana !== oldMana) {
            io.to(p.id).emit('statsUpdate', { id: p.id, stats: getStats(p) });
        }
    });
}, 1000);

// Start the server
server.listen(config.PORT, () => {
    console.log(`Serveur démarré sur le port ${config.PORT}`);
});
