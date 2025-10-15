export const pointsEqual = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  tolerance = 0.0001,
) => {
  return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance
}
