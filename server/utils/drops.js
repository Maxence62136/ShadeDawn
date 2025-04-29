// In-memory store of dropped items (map mapId -> drop records)
let nextDropId = 1;
const droppedItemsByMap = {};

/**
 * Add a dropped item to the map.
 * @param {string} mapId - ID of the map where the item is dropped.
 * @param {object} dropInfo - { playerId, itemType, quantity, x, y }
 * @returns {object} the created drop record, including id
 */
function addDrop(mapId, dropInfo) {
  const id = nextDropId++;
  const drop = { id, ...dropInfo, mapId };
  if (!droppedItemsByMap[mapId]) droppedItemsByMap[mapId] = {};
  droppedItemsByMap[mapId][id] = drop;
  return drop;
}

/**
 * Remove a dropped item by id.
 * @param {string} mapId - ID of the map where the item is located.
 * @param {number} id
 * @returns {object|null} the removed drop or null if not found
 */
function removeDrop(mapId, id) {
  if (!droppedItemsByMap[mapId]) return null;
  const drop = droppedItemsByMap[mapId][id] || null;
  if (drop) delete droppedItemsByMap[mapId][id];
  return drop;
}

/**
 * Get all dropped items in a specific map.
 * @param {string} mapId
 * @returns {object[]} Array of drop records
 */
function getDropsInMap(mapId) {
  return Object.values(droppedItemsByMap[mapId] || {});
}

module.exports = {
  addDrop,
  removeDrop,
  getDropsInMap
};
