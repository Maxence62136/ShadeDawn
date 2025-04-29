/**
 * BFS to compute all reachable tiles within a given range, avoiding obstacles.
 * @param {{x: number, y: number}} start - Starting tile coordinates.
 * @param {number} range - Maximum allowed steps.
 * @param {number[][]} grid - 2D array of tile types.
 * @returns {{x: number, y: number}[]} List of reachable tile coordinates, including the start.
 */
export function findReachable(start, range, grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const visited = new Set();
  const reachable = [];
  const queue = [{ x: start.x, y: start.y, dist: 0 }];
  visited.add(`${start.x},${start.y}`);
  while (queue.length > 0) {
    const { x, y, dist } = queue.shift();
    reachable.push({ x, y });
    if (dist >= range) continue;
    // Explore neighbors: up, down, left, right
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 0 && ny >= 0 && nx < cols && ny < rows &&
        !visited.has(key)
      ) {
        const t = grid[ny][nx];
        // Block water (1) and tree (2)
        if (t !== 1 && t !== 2) {
          visited.add(key);
          queue.push({ x: nx, y: ny, dist: dist + 1 });
        }
      }
    }
  }
  return reachable;
}
