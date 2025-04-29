/**
 * Server configuration constants.
 */
module.exports = {
  // Size of a single tile in pixels
  TILE_SIZE: 40,
  // Port to listen on (env PORT or 9782)
  PORT: process.env.PORT || 9782,
  // Game world dimensions (in pixels)
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 600
};
