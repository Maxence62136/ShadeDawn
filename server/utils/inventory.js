const { addDrop } = require('./drops');
const { players } = require('./players');

// In-memory inventory: map socketId to array of slots
const inventory = {};

/**
 * Initialize empty inventory for a new player.
 * @param {string} playerId
 */
function initInventory(playerId) {
  inventory[playerId] = Array(20).fill(null);
}

/**
 * Get player's current inventory.
 * @param {string} playerId
 * @returns {Array<object|null>}
 */
function getInventory(playerId) {
  return inventory[playerId] || [];
}

/**
 * Move an item within the inventory (client-sorted).
 * @param {string} playerId
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {boolean} true if moved
 */
function moveItem(playerId, fromIndex, toIndex) {
  const inv = inventory[playerId];
  if (!inv) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= inv.length || toIndex >= inv.length) return false;
  [inv[fromIndex], inv[toIndex]] = [inv[toIndex], inv[fromIndex]];
  return true;
}

/**
 * Drop an item from inventory onto the map.
 * @param {string} playerId
 * @param {number} slotIndex
 * @param {number} x - pixel x
 * @param {number} y - pixel y
 * @returns {object|null} dropped item info or null
 */
function dropItem(playerId, slotIndex, x, y) {
  const inv = inventory[playerId];
  if (!inv || slotIndex < 0 || slotIndex >= inv.length) return null;
  const item = inv[slotIndex];
  if (!item) return null;
  // Remove from inventory
  inv[slotIndex] = null;
  // Broadcast drop
  const drop = addDrop({
    playerId,
    itemType: item.type,
    quantity: item.quantity,
    x,
    y
  });
  return drop;
}

/**
 * Pick up a dropped item and add to inventory.
 * @param {string} playerId
 * @param {number} dropId
 * @param {function} removeDrop - from drops util
 * @returns {boolean}
 */
function pickupItem(playerId, dropId, removeDrop) {
  const inv = inventory[playerId];
  if (!inv) return false;
  // Remove drop and get its info
  const drop = removeDrop(dropId);
  if (!drop) return false;
  // Try to merge with existing stack
  const sameIdx = inv.findIndex(s => s && s.type === drop.itemType);
  if (sameIdx !== -1) {
    inv[sameIdx].quantity += drop.quantity;
    return true;
  }
  // Otherwise, find first empty slot
  const emptyIdx = inv.findIndex(s => !s);
  if (emptyIdx === -1) return false;
  inv[emptyIdx] = { type: drop.itemType, quantity: drop.quantity };
  return true;
}

module.exports = {
  initInventory,
  getInventory,
  moveItem,
  dropItem,
  pickupItem
};