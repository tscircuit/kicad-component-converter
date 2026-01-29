/**
 * Convert KiCad pin rotation angle to facing direction
 * KiCad pin rotation: 0° points right, 90° points up, 180° points left, 270° points down
 */
export function getDirectionFromRotation(
  rotation: number,
): "up" | "down" | "left" | "right" {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized >= 315 || normalized < 45) return "right"
  if (normalized >= 45 && normalized < 135) return "up"
  if (normalized >= 135 && normalized < 225) return "left"
  return "down"
}
