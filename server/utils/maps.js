const config = require('../config');
const fs = require('fs');
const path = require('path');

// Load maps configuration
const mapsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../maps.json'), 'utf8'));
const startMapId = mapsConfig.startMapId;
const maps = mapsConfig.maps;

// Teleporters per map
const teleportersByMap = {};
mapsConfig.teleporters.forEach(tp => {
  if (!teleportersByMap[tp.map]) teleportersByMap[tp.map] = [];
  teleportersByMap[tp.map].push(tp);
});

/**
 * Load a map by its ID, with teleporters.
 * @param {string} mapId
 * @returns {{id: string, cols: number, rows: number, tiles: number[][], teleporters: object[]}}
 */
function loadMap(mapId) {
  const map = maps[mapId];
  if (!map) throw new Error(`Map ID "${mapId}" not found in maps.json`);
  return {
    id: mapId,
    cols: map.cols,
    rows: map.rows,
    tiles: map.tiles,
    teleporters: teleportersByMap[mapId] || []
  };
}

module.exports = {
  loadMap,
  startMapId,
  /**
   * Get teleporters for a given map.
   * @param {string} mapId
   * @returns {Array<object>}
   */
  getTeleporters: (mapId) => teleportersByMap[mapId] || [],
  
  /**
   * Get the starting position on the starting map.
   * @returns {{mapId: string, x: number, y: number}}
   */
  getStartPosition: () => ({
    mapId: startMapId,
    x: 0,
    y: 0
  })
};
