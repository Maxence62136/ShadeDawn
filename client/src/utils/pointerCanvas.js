/**
 * Convert pointer (client) coordinates to canvas coordinate space.
 * @param {number} clientX - Client X coordinate (e.g., MouseEvent.clientX).
 * @param {number} clientY - Client Y coordinate (e.g., MouseEvent.clientY).
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @returns {{x: number, y: number}} Coordinates relative to canvas internal resolution.
 */
export function pointerToCanvas(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}
