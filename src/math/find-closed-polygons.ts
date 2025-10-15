import type { EdgeSegment } from "./edge-segment"
import { pointsEqual } from "./points-equal"

export const findClosedPolygons = (
  segments: EdgeSegment[],
): Array<EdgeSegment[]> => {
  const polygons: Array<EdgeSegment[]> = []
  const used = new Set<number>()

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue

    const polygon: EdgeSegment[] = [segments[i]]
    used.add(i)
    let currentEnd = segments[i].end

    // Try to find a closed loop
    let foundNext = true
    while (foundNext) {
      foundNext = false

      // Check if we've closed the loop
      if (polygon.length > 1 && pointsEqual(currentEnd, polygon[0].start)) {
        polygons.push(polygon)
        break
      }

      // Find the next segment
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue

        if (pointsEqual(currentEnd, segments[j].start)) {
          polygon.push(segments[j])
          used.add(j)
          currentEnd = segments[j].end
          foundNext = true
          break
        } else if (pointsEqual(currentEnd, segments[j].end)) {
          // Reverse the segment
          polygon.push({
            ...segments[j],
            start: segments[j].end,
            end: segments[j].start,
          })
          used.add(j)
          currentEnd = segments[j].start
          foundNext = true
          break
        }
      }

      if (!foundNext) {
        // Couldn't complete the polygon, clear used flags for this polygon
        for (let k = polygon.length - 1; k >= 0; k--) {
          const idx = segments.indexOf(polygon[k])
          if (idx !== -1) used.delete(idx)
        }
        break
      }
    }
  }

  return polygons
}
