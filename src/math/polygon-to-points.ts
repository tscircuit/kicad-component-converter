import type { EdgeSegment } from "./edge-segment"
import { generateArcPath, getArcLength } from "./arc-utils"

export const polygonToPoints = (
  polygon: EdgeSegment[],
): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = []

  for (const segment of polygon) {
    if (segment.type === "line") {
      // For lines, just add the start point (end point will be added by next segment)
      points.push(segment.start)
    } else if (segment.type === "arc" && segment.mid) {
      // For arcs, approximate with multiple points
      const arcLength = getArcLength(segment.start, segment.mid, segment.end)
      const numPoints = Math.max(3, Math.ceil(arcLength))
      const arcPoints = generateArcPath(
        segment.start,
        segment.mid,
        segment.end,
        numPoints,
      )
      // Add all arc points except the last one (will be added by next segment)
      points.push(...arcPoints.slice(0, -1))
    }
  }

  return points
}
