/**
 * Determine if there is a clear line of sight between two tiles using Bresenham's algorithm.
 * @param {{x: number, y: number}} start - Starting tile coordinates.
 * @param {{x: number, y: number}} end - Target tile coordinates.
 * @param {number[][]} grid - 2D array of tile types.
 * @returns {boolean}
 */
export function hasLineOfSight(start, end, grid) {
  let x0 = start.x, y0 = start.y;
  const x1 = end.x, y1 = end.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    // Check tile at (x0, y0)
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