import type { ParsedKicadSymbol } from "./parse-kicad-sym-to-circuit-json"

interface ConvertOptions {
  componentName?: string
}

function getDirectionFromRotation(
  rotation: number,
): "up" | "down" | "left" | "right" {
  // KiCad pin rotation: 0° points right, 90° points up, 180° points left, 270° points down
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized >= 315 || normalized < 45) return "right"
  if (normalized >= 45 && normalized < 135) return "up"
  if (normalized >= 135 && normalized < 225) return "left"
  return "down"
}

function formatNumber(n: number): string {
  // Round to 4 decimal places and remove trailing zeros
  const rounded = Math.round(n * 10000) / 10000
  return rounded.toString()
}

// Convert KiCad mm to tscircuit schematic units (typically 1mm = 1 unit)
// KiCad Y-axis is inverted relative to tscircuit
function toSchematicCoord(x: number, y: number): { schX: number; schY: number } {
  return {
    schX: x,
    schY: -y, // Flip Y axis
  }
}

export function convertKicadSymToTscircuitTsx(
  parsedSymbol: ParsedKicadSymbol,
  options: ConvertOptions = {},
): string {
  const { symbolData } = parsedSymbol
  const componentName =
    options.componentName ||
    symbolData.name.replace(/[^a-zA-Z0-9_]/g, "_") ||
    "MySymbol"

  const lines: string[] = []

  lines.push('import type { ChipProps } from "tscircuit"')
  lines.push("")
  lines.push(`export const ${componentName} = (props: ChipProps) => (`)
  lines.push("  <chip")
  lines.push("    {...props}")
  lines.push("    symbol={")
  lines.push("      <symbol>")

  // Add rectangles
  for (const rect of symbolData.rectangles) {
    const start = toSchematicCoord(rect.startX, rect.startY)
    const end = toSchematicCoord(rect.endX, rect.endY)
    const x = Math.min(start.schX, end.schX)
    const y = Math.min(start.schY, end.schY)
    const width = Math.abs(end.schX - start.schX)
    const height = Math.abs(end.schY - start.schY)
    lines.push(
      `        <schematicrect schX={${formatNumber(x + width / 2)}} schY={${formatNumber(y + height / 2)}} width={${formatNumber(width)}} height={${formatNumber(height)}} />`,
    )
  }

  // Add circles
  for (const circle of symbolData.circles) {
    const center = toSchematicCoord(circle.centerX, circle.centerY)
    lines.push(
      `        <schematiccircle schX={${formatNumber(center.schX)}} schY={${formatNumber(center.schY)}} radius={${formatNumber(circle.radius)}} />`,
    )
  }

  // Add polylines as schematicpath
  for (const polyline of symbolData.polylines) {
    if (polyline.points.length < 2) continue

    const pathPoints = polyline.points.map((p) => {
      const coord = toSchematicCoord(p.x, p.y)
      return `{ x: ${formatNumber(coord.schX)}, y: ${formatNumber(coord.schY)} }`
    })
    lines.push(
      `        <schematicpath points={[${pathPoints.join(", ")}]} />`,
    )
  }

  // Add arcs
  for (const arc of symbolData.arcs) {
    const start = toSchematicCoord(arc.startX, arc.startY)
    const end = toSchematicCoord(arc.endX, arc.endY)
    // For arcs, we need to calculate center and angles from start/mid/end points
    // For now, render as a simple path from start to end via mid
    const mid = toSchematicCoord(arc.midX, arc.midY)
    lines.push(
      `        <schematicpath points={[{ x: ${formatNumber(start.schX)}, y: ${formatNumber(start.schY)} }, { x: ${formatNumber(mid.schX)}, y: ${formatNumber(mid.schY)} }, { x: ${formatNumber(end.schX)}, y: ${formatNumber(end.schY)} }]} />`,
    )
  }

  // Add lines from pin position to body (pin stubs)
  // And add ports at the end of pins
  for (const pin of symbolData.pins) {
    const pinPos = toSchematicCoord(pin.x, pin.y)
    const direction = getDirectionFromRotation(pin.rotation)
    const length = pin.length

    // Calculate the end point of the pin (where it connects to the body)
    let bodyX = pinPos.schX
    let bodyY = pinPos.schY
    switch (direction) {
      case "right":
        bodyX -= length
        break
      case "left":
        bodyX += length
        break
      case "up":
        bodyY -= length
        break
      case "down":
        bodyY += length
        break
    }

    // Draw the pin line
    lines.push(
      `        <schematicline x1={${formatNumber(pinPos.schX)}} y1={${formatNumber(pinPos.schY)}} x2={${formatNumber(bodyX)}} y2={${formatNumber(bodyY)}} />`,
    )

    // Add the port at the pin tip
    const portName = pin.number || pin.name || "1"
    lines.push(
      `        <port name="${portName}" schX={${formatNumber(pinPos.schX)}} schY={${formatNumber(pinPos.schY)}} direction="${direction}" />`,
    )
  }

  // Add text elements (excluding property texts like reference and value)
  for (const text of symbolData.texts) {
    if (!text.value) continue
    const pos = toSchematicCoord(text.x, text.y)
    lines.push(
      `        <schematictext schX={${formatNumber(pos.schX)}} schY={${formatNumber(pos.schY)}} text="${text.value.replace(/"/g, '\\"')}" />`,
    )
  }

  lines.push("      </symbol>")
  lines.push("    }")
  lines.push("  />")
  lines.push(")")
  lines.push("")

  return lines.join("\n")
}
