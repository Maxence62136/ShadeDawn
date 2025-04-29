const config = require('../config');

/**
 * Check if two tiles are within a given Manhattan range.
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @param {number[][]} grid
 * @param {number} range
 * @returns {boolean}
 */
function isReachableWithin(start, goal, grid, range) {
  const dx = Math.abs(goal.x - start.x);
  const dy = Math.abs(goal.y - start.y);
  return dx + dy <= range;
}

/**
 * Determine if there is a clear line of sight between two tiles (Bresenham).
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @param {number[][]} grid
 * @returns {boolean}
 */
function hasLineOfSightServer(start, goal, grid) {
  let x0 = start.x, y0 = start.y;
  const x1 = goal.x, y1 = goal.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    const row = grid[y0];
    if (!row) return false;
    const tile = row[x0];
    // Blocked by water (1) or tree (2)
    if (tile === 1 || tile === 2) return false;
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

module.exports = {
  isReachableWithin,
  hasLineOfSightServer
};
