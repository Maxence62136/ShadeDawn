const config = require('../config');

// In-memory store of connected players
const players = {};

/**
 * Add a new player with a fixed spawn position on the given map.
 * @param {string} id - Socket ID of the player.
 * @param {string} mapId - Initial map identifier.
 * @returns {object} Newly created player.
 */
function addPlayer(id, mapId) {
  // Spawn player at fixed position (0, 0)
  const x = 0; // Forcer le spawn à 0, 0
  const y = 0;
  const player = { id, x, y, name: null, mapId,
    // Stats
    life: 100,
    mana: 50,
    xp: 0,
    level: 1
  };
  players[id] = player;
  return player;
}

/**
 * Remove a player by ID.
 * @param {string} id - Socket ID.
 */
function removePlayer(id) {
  delete players[id];
}

/**
 * Get an array of all current players.
 * @returns {Array<object>}
 */
function getAllPlayers() {
  return Object.values(players);
}

/**
 * Update an existing player's position.
 * @param {string} id - Socket ID of the player.
 * @param {number} x - New x-coordinate in pixels.
 * @param {number} y - New y-coordinate in pixels.
 */
function updatePlayerPosition(id, x, y) {
  if (players[id]) {
    players[id].x = x;
    players[id].y = y;
  }
}

/**
 * Set the name of a player.
 * @param {string} id - Socket ID.
 * @param {string} name - Player's chosen name.
 */
function setPlayerName(id, name) {
  if (players[id]) {
    players[id].name = name;
  }
}

module.exports = {
  addPlayer,
  removePlayer,
  getAllPlayers,
  updatePlayerPosition,
  setPlayerName,
  // Expose internal players store
  players
};
