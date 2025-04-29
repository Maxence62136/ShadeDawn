import { startGameLoop } from './Game.js';
import { pointerToCanvas } from './utils/pointerCanvas.js';
import { pixelsToTiles, tilesToPixels } from './utils/tilePixelConversion.js';
import { findPath } from './pathfinding/aStar.js';
import { SpellManager } from './spells/spellManager.js';
import { AudioController } from './audio/audioController.js';

// Connect to the server via Socket.io
const socket = io();
// Initialize audio controller (background music)
const audioController = new AudioController();
// Settings popup: button, modal and controls
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const settingsMuteButton = document.getElementById('settingsMuteButton');
const settingsVolumeSlider = document.getElementById('settingsVolumeSlider');
const replayButton = document.getElementById('replayButton');
const quitButton = document.getElementById('quitButton');
const settingsCloseButton = document.getElementById('settingsCloseButton');
// Open settings modal
if (settingsButton && settingsModal) {
  settingsButton.addEventListener('click', () => settingsModal.classList.add('active'));
  // Close modal on background click
  settingsModal.addEventListener('click', () => settingsModal.classList.remove('active'));
  // Prevent closing when clicking inside content
  const modalContent = settingsModal.querySelector('.modal-content');
  if (modalContent) modalContent.addEventListener('click', e => e.stopPropagation());
}
// Sync audio settings controls
if (settingsMuteButton) {
  // Initial icon
  settingsMuteButton.textContent = audioController.audio.muted ? '🔇' : '🔊';
    settingsMuteButton.addEventListener('click', () => {
      audioController.toggleMute();
      const icon = audioController.audio.muted ? '🔇' : '🔊';
      settingsMuteButton.textContent = icon;
    });
}
if (settingsVolumeSlider) {
  // Initial value
  settingsVolumeSlider.value = audioController.volume;
  settingsVolumeSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    audioController.setVolume(v);
  });
}
// Replay and Quit buttons
if (replayButton) replayButton.addEventListener('click', () => window.location.reload());
if (quitButton) quitButton.addEventListener('click', () => { window.location.href = 'https://google.com'; });
// Game Over modal controls
const gameOverReplay = document.getElementById('gameOverReplay');
const gameOverQuit = document.getElementById('gameOverQuit');
if (gameOverReplay) gameOverReplay.addEventListener('click', () => window.location.reload());
if (gameOverQuit) gameOverQuit.addEventListener('click', () => { window.location.href = 'https://google.com'; });
// Close settings modal via Retour button
if (settingsCloseButton && settingsModal) settingsCloseButton.addEventListener('click', () => settingsModal.classList.remove('active'));
// Spell manager (handles selection, preview, casting, active spells)
let spellManager = null;
let localPlayerId = null;
let mapData = null;
// Shared state for mapData and drops, passed to Game.js
const gameState = { mapData: null, drops: [] };
// Current map ID (for multi-map)
let currentMapId = null;
// Flag to disable input and preview during map transitions
let isChangingMap = false;
// Delay before removing picked up drops (ms), matches movement animation duration
const MOVE_ANIM_DURATION = 200;
// Sequence ID for movement path; incremented on each click to cancel old paths
let moveSeq = 0;

// Shared object of all players, keyed by socket ID
let players = {};
// Initialize SpellManager
spellManager = new SpellManager(socket, players);
// Inventory slots and dropped items
const inventorySlots = Array.from(document.querySelectorAll('.inventory-slot'));
// Tooltip element for inventory and drops
const tooltip = document.getElementById('tooltip');
let lastInventory = [];
let localDrops = [];
// Utility: update inventory UI
function updateInventoryUI(inv) {
    inventorySlots.forEach((el, idx) => {
        el.innerHTML = '';
        const item = inv[idx];
        if (item) {
            // Create item icon
            const img = document.createElement('img');
            img.src = `/assets/items/${item.type}.png`;
            img.className = 'item-icon';
            img.draggable = true;
            img.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', idx);
            });
            el.appendChild(img);
            // Quantity overlay if stacked
            if (item.quantity > 1) {
                const qty = document.createElement('div');
                qty.className = 'item-qty';
                qty.textContent = item.quantity;
                el.appendChild(qty);
            }
        }
    });
    // Store last inventory for tooltip
    lastInventory = inv;
}
// Drag & drop handlers
inventorySlots.forEach(el => {
    el.addEventListener('dragover', e => e.preventDefault());
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = parseInt(el.dataset.slot, 10);
        socket.emit('moveItem', { from, to });
    });
});
// Inventory tooltip: show on hover
inventorySlots.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
        const idx = parseInt(el.dataset.slot, 10);
        const item = lastInventory[idx];
        if (!item) return;
        tooltip.textContent = `${item.type} x${item.quantity}`;
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
        tooltip.style.display = 'block';
    });
    el.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    });
    el.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
});

/**
 * Create an internal player state for movement animation.
 * @param {{id: string, x: number, y: number}} p
 */
function createPlayerState(p) {
    return {
        id: p.id,
        x: p.x,
        y: p.y,
        name: p.name || null,
        mapId: p.mapId || null,
        queue: [],
        moving: false,
        // Buff end timestamp (for size buff)
        buffEnd: p.buffEnd
    };
}

// On successful connection, track our socket ID
socket.on('connect', () => {
    localPlayerId = socket.id;
    // Show name entry modal
    const modal = document.getElementById('nameModal');
    const input = document.getElementById('nameInput');
    const btn = document.getElementById('nameSubmit');
    modal.classList.add('active');
    input.focus();
    // Submit name
    function submitName() {
        const name = input.value.trim();
        if (name) {
            modal.classList.remove('active');
            socket.emit('setName', { name });
        }
    }
    btn.addEventListener('click', submitName);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitName();
    });
});
// Inventory synchronization
socket.on('currentInventory', (inv) => updateInventoryUI(inv));
socket.on('inventoryUpdated', (inv) => updateInventoryUI(inv));
// Drops synchronization
socket.on('currentDrops', (drops) => {
    // Initialize drops for tooltip and rendering
    localDrops = drops;
    // Seed render state
    if (Array.isArray(gameState.drops)) {
        gameState.drops.splice(0, gameState.drops.length, ...drops);
    }
});
socket.on('itemDropped', (drop) => {
    // Add new drop to current map state
    localDrops.push(drop);
    if (Array.isArray(gameState.drops)) {
        gameState.drops.push(drop);
    }
});
socket.on('itemPicked', ({ dropId }) => {
    // Delay removal until after movement animation completes
    setTimeout(() => {
        const idx1 = localDrops.findIndex(d => d.id === dropId);
        if (idx1 !== -1) localDrops.splice(idx1, 1);
        const idx2 = gameState.drops.findIndex(d => d.id === dropId);
        if (idx2 !== -1) gameState.drops.splice(idx2, 1);
    }, MOVE_ANIM_DURATION);
});
// Receive list of current players
socket.on('currentPlayers', (existingPlayers) => {
    // Reset players in the existing object for game loop visibility
    Object.keys(players).forEach(id => delete players[id]);
    existingPlayers.forEach((player) => {
        players[player.id] = createPlayerState(player);
    });
});

// Handle stats updates (life, mana, xp, level)
socket.on('statsUpdate', ({ id, stats }) => {
  if (id !== localPlayerId) return;
  // Update HP bar
  const hpBar = document.getElementById('hpBar');
  const hpText = document.getElementById('hpText');
  if (hpBar && hpText) {
    const pct = Math.round((stats.life / 100) * 100);
    hpBar.style.width = `${pct}%`;
    hpText.textContent = `${stats.life}/100`;
  }
  // Update Mana bar
  const manaBar = document.getElementById('manaBar');
  const manaText = document.getElementById('manaText');
  if (manaBar && manaText) {
    const pctM = Math.round((stats.mana / 50) * 100);
    manaBar.style.width = `${pctM}%`;
    manaText.textContent = `${stats.mana}/50`;
  }
  // Update XP bar and level
  const xpBar = document.getElementById('xpBar');
  const xpText = document.getElementById('xpText');
  const levelText = document.getElementById('levelText');
  if (xpBar && xpText && levelText) {
    const needed = stats.xpToNext || 0;
    const pctX = needed > 0 ? Math.round((stats.xp / needed) * 100) : 0;
    xpBar.style.width = `${pctX}%`;
    xpText.textContent = `${stats.xp}/${needed}`;
    levelText.textContent = stats.level;
  }
});

// Death state
let isDead = false;
// New player joined
socket.on('newPlayer', (player) => {
    players[player.id] = createPlayerState(player);
});

// Player disconnected
socket.on('playerDisconnected', (id) => {
    delete players[id];
});

// Handle movement updates from server
socket.on('playerMoved', ({ id, x, y, seq }) => {
    const p = players[id];
    if (!p) return;
    // If this is the local player, ignore moves from old sequences
    if (id === localPlayerId && seq !== moveSeq) return;
    // Queue movement for smooth animation
    p.queue.push({ x, y });
});
// Handle spells from server
socket.on('spellCast', (data) => {
    if (spellManager) spellManager.spawnSpell(data);
});
// Handle server-authoritative teleport from spell1
socket.on('playerTeleported', ({ id, x, y }) => {
    const p = players[id];
    if (!p) return;
    // Immediately move player to new pos and clear movement queue
    p.x = x;
    p.y = y;
    p.queue = [];
    p.moving = false;
});
// Handle orb expiration
socket.on('spellExpired', ({ id }) => {
    if (spellManager) spellManager.removeOrb(id);
});
// Handle player death
socket.on('playerDied', ({ id }) => {
    if (id === localPlayerId) {
        isDead = true;
        const over = document.getElementById('gameOverModal');
        if (over) over.classList.add('active');
    } else {
        delete players[id];
    }
});
// Handle other players being removed (teleport or disconnect)
socket.on('playerRemoved', (id) => {
    delete players[id];
});
// Handle player name updates
socket.on('playerName', ({ id, name }) => {
    const p = players[id];
    if (p) p.name = name;
});
// Handle map changes (teleporters)
socket.on('changeMap', ({ mapData: newMap, players: newPlayers, drops }) => {
    // Begin map transition: block input and show fade overlay
    isChangingMap = true;
    const fade = document.getElementById('fade');
    fade.classList.add('active');
    // After fade-in completes, switch map data and drops, then fade-out
    const onFadeIn = () => {
        fade.removeEventListener('transitionend', onFadeIn);
        // Update map data, players, and drops while screen is covered
        mapData = newMap;
        gameState.mapData = newMap;
        currentMapId = newMap.id;
        // Reset players for new map
        Object.keys(players).forEach(id => delete players[id]);
        newPlayers.forEach(p => { players[p.id] = createPlayerState(p); });
        // Update drops for rendering and tooltip
        localDrops = drops;
        if (Array.isArray(gameState.drops)) {
            gameState.drops.splice(0, gameState.drops.length, ...drops);
        }
        // Clear path preview on map change
        gameState.previewDest = null;
        // Start fade-out
        fade.classList.remove('active');
        // After fade-out completes, re-enable input
        const onFadeOut = () => {
            fade.removeEventListener('transitionend', onFadeOut);
            isChangingMap = false;
        };
        fade.addEventListener('transitionend', onFadeOut);
    };
    fade.addEventListener('transitionend', onFadeIn);
});

// Tell the server to add this client as a player
// Note: server adds player automatically on connection

// Set up click-to-move with A* pathfinding
const canvas = document.getElementById('gameCanvas');
canvas.addEventListener('click', async (ev) => {
    // Block actions if dead or during map transitions
    if (isDead || isChangingMap) return;
    if (!mapData || !localPlayerId || !players[localPlayerId]) return;
    // Determine click in tile coords
    const { x, y } = pointerToCanvas(ev.clientX, ev.clientY, canvas);
    const tileX = pixelsToTiles(x);
    const tileY = pixelsToTiles(y);
    const destX = tilesToPixels(tileX);
    const destY = tilesToPixels(tileY);
    // If a spell is selected, attempt to cast
    if (spellManager && spellManager.selected) {
        spellManager.cast(tileX, tileY);
        return;
    }
    // Otherwise, movement: cancel previous path and queue new
    moveSeq++;
    const thisSeq = moveSeq;
    players[localPlayerId].queue = [];
    const goalTileX = tileX;
    const goalTileY = tileY;
    // Determine start tile
    const startPx = players[localPlayerId].x;
    const startPy = players[localPlayerId].y;
    const startTileX = pixelsToTiles(startPx);
    const startTileY = pixelsToTiles(startPy);
    // Compute path
    const path = findPath(
        { x: startTileX, y: startTileY },
        { x: goalTileX, y: goalTileY },
        mapData.tiles
    );
    if (!path) {
        console.warn('No path to destination');
        return;
    }
    // Store destination for path preview
    gameState.previewDest = { x: tileX, y: tileY };
    // Animate movement: step-by-step
    const delay = 200; // ms per tile
    for (let i = 1; i < path.length; i++) {
        // Stop if a new movement command was issued
        if (moveSeq !== thisSeq) break;
        const node = path[i];
        const destX = tilesToPixels(node.x);
        const destY = tilesToPixels(node.y);
        const isLast = (i === path.length - 1);
        socket.emit('moveTo', { x: destX, y: destY, seq: thisSeq, isLast });
        // wait before next step
        await new Promise(res => setTimeout(res, delay));
    }
});
// Canvas drop tooltip: hide on leave
canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    // Clear movement path preview when mouse leaves
    gameState.previewDest = null;
});
// Canvas hover: show drop tooltip and path preview; update cursor for blocked tiles
canvas.addEventListener('mousemove', (ev) => {
    if (!mapData) return;
    const { x, y } = pointerToCanvas(ev.clientX, ev.clientY, canvas);
    const tileX = pixelsToTiles(x);
    const tileY = pixelsToTiles(y);
    // Update movement path preview if appropriate
    if (!isChangingMap && spellManager && !spellManager.selected && localPlayerId && players[localPlayerId]) {
        gameState.previewDest = { x: tileX, y: tileY };
    }
    // Determine tile type and set cursor
    const tileType = mapData.tiles[tileY] && mapData.tiles[tileY][tileX];
    if (tileType === 1 || tileType === 2) {
        canvas.style.cursor = 'not-allowed';
    } else {
        canvas.style.cursor = 'pointer';
    }
    // Show drop tooltip
    const destX = tilesToPixels(tileX);
    const destY = tilesToPixels(tileY);
    const drop = localDrops.find(d => d.x === destX && d.y === destY);
    if (drop) {
        tooltip.textContent = `${drop.itemType} x${drop.quantity}`;
        tooltip.style.left = `${ev.pageX + 10}px`;
        tooltip.style.top = `${ev.pageY + 10}px`;
        tooltip.style.display = 'block';
    } else {
        tooltip.style.display = 'none';
    }
});
// Drag & drop inventory items onto map canvas
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!mapData) return;
    // Set cursor for drop validity: no-drop on blocked tiles, copy otherwise
    const { x, y } = pointerToCanvas(e.clientX, e.clientY, canvas);
    const tileX = pixelsToTiles(x);
    const tileY = pixelsToTiles(y);
    const tileType = mapData.tiles[tileY] && mapData.tiles[tileY][tileX];
    if (tileType === 1 || tileType === 2) {
        canvas.style.cursor = 'no-drop';
    } else {
        canvas.style.cursor = 'copy';
    }
});
canvas.addEventListener('drop', (e) => {
    // Block dropping items during map transitions
    if (isChangingMap) return;
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const { x, y } = pointerToCanvas(e.clientX, e.clientY, canvas);
    const tileX = pixelsToTiles(x);
    const tileY = pixelsToTiles(y);
    const destX = tilesToPixels(tileX);
    const destY = tilesToPixels(tileY);
    socket.emit('dropItem', { slot: from, x: destX, y: destY });
    // Reset cursor after drop
    canvas.style.cursor = '';
});
// Reset cursor when drag leaves canvas
canvas.addEventListener('dragleave', () => {
    canvas.style.cursor = '';
});

// Receive map data and start the game loop
socket.on('mapData', (map) => {
    // Update shared state and map ID
    mapData = map;
    gameState.mapData = map;
    currentMapId = map.id;
    // Initialize spell manager with map data
    if (spellManager) spellManager.setMapData(map);
    // Provide local player ID for path preview
    gameState.localPlayerId = localPlayerId;
    // Start rendering and update loop with shared state
    startGameLoop(players, gameState, spellManager);
});
