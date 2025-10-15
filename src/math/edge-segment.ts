export interface EdgeSegment {
  type: "line" | "arc"
  start: { x: number; y: number }
  end: { x: number; y: number }
  mid?: { x: number; y: number }
  strokeWidth: number
}
