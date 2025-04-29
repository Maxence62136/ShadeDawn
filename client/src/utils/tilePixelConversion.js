/**
 * Constants for tile size. Should match server config.
 */
const TILE_SIZE = 40;

/**
 * Convert pixel value to tile index (integer).
 * @param {number} px - Pixel coordinate or length.
 * @returns {number} Tile index (floor(px / TILE_SIZE)).
 */
export function pixelsToTiles(px) {
  return Math.floor(px / TILE_SIZE);
}

/**
 * Convert tile index to pixel coordinate (top-left of tile).
 * @param {number} tile - Tile index.
 * @returns {number} Pixel coordinate (tile * TILE_SIZE).
 */
export function tilesToPixels(tile) {
  return tile * TILE_SIZE;
}
