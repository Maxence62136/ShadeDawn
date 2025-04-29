/**
 * A* pathfinding on a 2D grid.
 * @param {{x: number, y: number}} start - tile coords of start.
 * @param {{x: number, y: number}} goal - tile coords of target.
 * @param {number[][]} grid - 2D array of tile types (rows x cols).
 * @returns {{x: number, y: number}[]|null} Array of tile coords from start to goal, or null if no path.
 */
export function findPath(start, goal, grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  // Helper to check if tile is within bounds and passable
  function isPassable(x, y) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    const t = grid[y][x];
    // Blocked on water (1) or tree (2)
    return t !== 1 && t !== 2;
  }
  // Heuristic: Manhattan distance
  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  // Open set as a simple array
  const openSet = new Set([startKey]);
  // Map of node key to g score
  const gScore = { [startKey]: 0 };
  // Map of node key to f score
  const fScore = { [startKey]: heuristic(start, goal) };
  // Map of navigated nodes
  const cameFrom = {};

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let currentKey = null;
    let lowestF = Infinity;
    openSet.forEach((key) => {
      const f = fScore[key] ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentKey = key;
      }
    });
    if (!currentKey) break;
    if (currentKey === goalKey) {
      // Reconstruct path
      const path = [];
      let key = currentKey;
      while (key) {
        const [x, y] = key.split(',').map(Number);
        path.unshift({ x, y });
        key = cameFrom[key];
      }
      return path;
    }
    openSet.delete(currentKey);
    const [cx, cy] = currentKey.split(',').map(Number);
    // Explore neighbors (4-way)
    const neighbors = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 }
    ];
    neighbors.forEach(({ x, y }) => {
      const neighborKey = `${x},${y}`;
      if (!isPassable(x, y)) return;
      const tentativeG = (gScore[currentKey] ?? Infinity) + 1;
      if (tentativeG < (gScore[neighborKey] ?? Infinity)) {
        // This path to neighbor is better
        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentativeG;
        fScore[neighborKey] = tentativeG + heuristic({ x, y }, goal);
        openSet.add(neighborKey);
      }
    });
  }
  // No path found
  return null;
}
