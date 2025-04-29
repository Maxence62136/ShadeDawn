/**
 * Game.js
 * Orchestration, boucle de jeu et rendu global.
 */

/**
 * Start the main game loop: update and render.
 * @param {Object} players - map of playerId to player data.
 */
/**
 * Start the main game loop: update and render map and players.
 * @param {Object} players - map of playerId to player data.
 * @param {{cols: number, rows: number, tiles: number[][]}} mapData - grid map info.
 */
/**
 * Game.js
 * Orchestration, boucle de jeu, rendu de la carte et des joueurs.
 */

import { findPath } from './pathfinding/aStar.js';
// Mapping tile IDs to image filenames (expect these in client/assets/tileset)
const TILE_TYPE_NAMES = {
    0: 'grass',
    1: 'water',
    2: 'tree',
    3: 'sand'
};

/**
 * Load all tile images and return a map of ID to HTMLImageElement.
 * @returns {Promise<Object<string, HTMLImageElement>>}
 */
/**
 * Load all tile images and return a map of ID to HTMLImageElement.
 * @returns {Promise<Object<string, HTMLImageElement>>}
 */
function loadTileImages() {
    const promises = [];
    const images = {};
    Object.entries(TILE_TYPE_NAMES).forEach(([id, name]) => {
        const img = new Image();
        img.src = `/assets/tileset/${name}.png`;
        // Resolve on load or error (to avoid blocking)
        const p = new Promise((res) => {
            img.onload = () => res();
            img.onerror = () => {
                console.warn(`Could not load tile image: ${name}.png`);
                res();
            };
        });
        images[id] = img;
        promises.push(p);
    });
    return Promise.all(promises).then(() => images);
}

/**
 * Load player sprite sheets for idle and walk animations.
 * @returns {Promise<{idle: HTMLImageElement, walk: HTMLImageElement}>}
 */
function loadPlayerSprites() {
    const idle = new Image(); idle.src = '/assets/sprites/knight/idle.png';
    const walk = new Image(); walk.src = '/assets/sprites/knight/walk.png';
    return Promise.all([
        new Promise(res => { idle.onload = idle.onerror = () => res(); }),
        new Promise(res => { walk.onload = walk.onerror = () => res(); })
    ]).then(() => ({ idle, walk }));
}

/**
 * Load teleporter overlay image.
 * @returns {Promise<HTMLImageElement|null>}
 */
function loadTeleporterImage() {
    const img = new Image();
    img.src = '/assets/tileset/teleporter.png';
    return new Promise(res => {
        img.onload = () => res(img);
        img.onerror = () => {
            console.warn('Could not load teleporter image: teleporter.png');
            res(null);
        };
    });
}

/**
 * Load item images for rendering drops.
 * @returns {Promise<Object<string, HTMLImageElement>>}
 */
function loadItemImages() {
    const itemNames = ['apple', 'stone', 'potion'];
    const images = {};
    const promises = [];
    itemNames.forEach(name => {
        const img = new Image();
        img.src = `/assets/items/${name}.png`;
        const p = new Promise(res => { img.onload = img.onerror = () => res(); });
        images[name] = img;
        promises.push(p);
    });
    return Promise.all(promises).then(() => images);
}

/**
 * Start the main game loop: update and render map and players.
 * @param {Object} players - map of playerId to player data.
 * @param {{cols: number, rows: number, tiles: number[][]}} mapData - grid map info.
 */
/**
 * Start the main game loop: update and render map, players, and spells.
 * @param {Object} players - map of playerId to player state.
 * @param {{cols: number, rows: number, tiles: number[][]}} mapData - grid map info.
 * @param {SpellManager} spellManager - manager for spells and overlays.
 */
/**
 * Start the main game loop: update and render map, drops, players and spells.
 * @param {Object} players - map of playerId to player state.
 * @param {{cols: number, rows: number, tiles: number[][]}} mapData - grid map info.
 * @param {SpellManager} spellManager - manager for spells and overlays.
 * @param {Array} drops - reference to array of dropped items ({id,x,y,itemType,quantity}).
 */
/**
 * Start the main game loop: update and render map, drops, players and spells.
 * @param {Object} players - map of playerId to player state.
 * @param {{mapData:object, drops:object[]}} state - shared state, updated on map change.
 * @param {SpellManager} spellManager - manager for spells and overlays.
 */
export function startGameLoop(players, state, spellManager) {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    // Disable image smoothing for crisp pixel art rendering
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    const GAME_WIDTH = canvas.width;
    const GAME_HEIGHT = canvas.height;
    function getTiles() { return state.mapData.tiles; }
    function getCols() { return state.mapData.cols; }
    function getRows() { return state.mapData.rows; }
    const TILE_SIZE = GAME_WIDTH / getCols();

    // Responsive resize
    function resizeCanvas() {
        const windowRatio = window.innerWidth / window.innerHeight;
        const gameRatio = GAME_WIDTH / GAME_HEIGHT;
        let newWidth, newHeight;
        if (windowRatio < gameRatio) {
            newWidth = window.innerWidth;
            newHeight = newWidth / gameRatio;
        } else {
            newHeight = window.innerHeight;
            newWidth = newHeight * gameRatio;
        }
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Once tile images are loaded, start rendering loop
    // After loading tile images, start the game loop with smooth movement
    // Load map tiles and player sprites
    Promise.all([loadTileImages(), loadPlayerSprites(), loadTeleporterImage(), loadItemImages()])
        .then(([tileImages, playerSprites, teleporterImg, itemImages]) => {
            const MOVE_DURATION = 200; // ms per tile movement
            let lastTime = performance.now();
            function loop(now) {
                const delta = now - lastTime;
                lastTime = now;
                // Update player movement queues
                for (const id in players) {
                    const p = players[id];
                    // Only render players in the current map
                    if (p.mapId !== state.mapData.id) continue;
                    // Initialize movement state if not present
                    if (!Array.isArray(p.queue)) p.queue = [];
                    if (p.moving === undefined) p.moving = false;
                    if (!p.moving && p.queue.length > 0) {
                        // Start next move
                        const next = p.queue.shift();
                        p.startX = p.x;
                        p.startY = p.y;
                        p.destX = next.x;
                        p.destY = next.y;
                        p.moveStart = now;
                        p.moving = true;
                    }
                    if (p.moving) {
                        const t = (now - p.moveStart) / MOVE_DURATION;
                        if (t >= 1) {
                            p.x = p.destX;
                            p.y = p.destY;
                            p.moving = false;
                        } else {
                            p.x = p.startX + (p.destX - p.startX) * t;
                            p.y = p.startY + (p.destY - p.startY) * t;
                        }
                    }
                }
                // Clear canvas
                ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                // Draw map
                for (let r = 0; r < getRows(); r++) {
                    for (let c = 0; c < getCols(); c++) {
                        const type = getTiles()[r][c];
                        const img = tileImages[type];
                        if (img && img.complete) {
                            ctx.drawImage(img, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        } else {
                            ctx.fillStyle = type === 1 ? '#3972a0' : type === 2 ? '#654321' : type === 3 ? '#e2c08d' : '#3cba54';
                            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }
                }
                // Draw path preview for local player movement
                if (state.previewDest) {
                    const lp = players[state.localPlayerId];
                    if (lp && lp.mapId === state.mapData.id) {
                        const start = { x: Math.floor(lp.x / TILE_SIZE), y: Math.floor(lp.y / TILE_SIZE) };
                        const goal = state.previewDest;
                        const path = findPath(start, goal, state.mapData.tiles);
                        if (path) {
                            // Draw each step in the path
                            ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                            path.forEach(({ x, y }) => {
                                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                            });
                            // If destination reached, clear preview
                            const currentTile = { x: Math.floor(lp.x / TILE_SIZE), y: Math.floor(lp.y / TILE_SIZE) };
                            if (currentTile.x === goal.x && currentTile.y === goal.y) {
                                state.previewDest = null;
                            }
                        }
                    }
                }
                // Draw dropped items using item sprites
                if (Array.isArray(state.drops)) {
                    state.drops.forEach(d => {
                        const img = itemImages[d.itemType];
                        if (img && img.complete) {
                            ctx.drawImage(img, d.x, d.y, TILE_SIZE, TILE_SIZE);
                        } else {
                            ctx.fillStyle = 'orange';
                            ctx.fillRect(d.x, d.y, TILE_SIZE, TILE_SIZE);
                        }
                        // Draw quantity if more than one
                        if (d.quantity > 1) {
                            ctx.fillStyle = 'white';
                            ctx.font = `${TILE_SIZE / 2}px sans-serif`;
                            ctx.fillText(d.quantity, d.x + TILE_SIZE - 4, d.y + TILE_SIZE - 4);
                        }
                    });
                }
                // Draw teleporters
                if (Array.isArray(state.mapData.teleporters)) {
                    state.mapData.teleporters.forEach(tp => {
                        const px = tp.x * TILE_SIZE;
                        const py = tp.y * TILE_SIZE;
                        if (teleporterImg && teleporterImg.complete) {
                            ctx.drawImage(teleporterImg, px, py, TILE_SIZE, TILE_SIZE);
                        } else {
                            ctx.strokeStyle = 'yellow';
                            ctx.lineWidth = 2;
                            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                        }
                    });
                }
                // Draw spell overlays and active spells
                if (spellManager) spellManager.draw(ctx, TILE_SIZE);
                // Draw players (with sprite animations and buff size)
                const currentTime = Date.now();
                for (const id in players) {
                    const p = players[id];
                    // Only render players in this map
                    if (p.mapId !== state.mapData.id) continue;
                    // Initialize animation state
                    if (p.frameIndex === undefined) p.frameIndex = 0;
                    if (p.frameTimer === undefined) p.frameTimer = 0;
                    // Update animation timer
                    p.frameTimer += delta;
                    const FRAME_DURATION = 200; // ms per frame
                    const FRAME_COUNT = 3;
                    if (p.frameTimer >= FRAME_DURATION) {
                        p.frameTimer -= FRAME_DURATION;
                        p.frameIndex = (p.frameIndex + 1) % FRAME_COUNT;
                    }
                    // Determine sprite and size (p.x and p.y sont le coin supérieur gauche)
                    const sprite = p.moving ? playerSprites.walk : playerSprites.idle;
                    let size = TILE_SIZE;
                    if (p.buffEnd && currentTime < p.buffEnd) size = TILE_SIZE * 2;
                    const offset = (size - TILE_SIZE) / 2; // offset = 0 pour taille normale, TILE_SIZE/2 pour buff
                    // Draw sprite frame en corrigeant la position
                    const frameWidth = sprite.width / FRAME_COUNT;
                    const frameHeight = sprite.height;
                    ctx.drawImage(
                        sprite,
                        frameWidth * p.frameIndex, 0,
                        frameWidth, frameHeight,
                        p.x - offset, p.y - offset,
                        size, size
                    );
                    // Draw player name or ID above the sprite, with outline
                    const label = p.name || id.slice(0, 4);
                    // Choose font size relative to sprite size
                    ctx.font = `${Math.floor(size / 4)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    // Outline for better readability
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'black';
                    ctx.fillStyle = 'white';
                    const textX = p.x - offset + size / 2;
                    const textY = p.y - offset - 2;
                    ctx.strokeText(label, textX, textY);
                    ctx.fillText(label, textX, textY);
                }
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        });
}