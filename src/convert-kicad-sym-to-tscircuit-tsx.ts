import type { ParsedKicadSymbol } from "./parse-kicad-sym-to-circuit-json"
import { getDirectionFromRotation } from "./utils/get-direction-from-rotation"
import { formatNumber } from "./utils/format-number"
import { toSchematicCoord } from "./utils/to-schematic-coord"
import {
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_SCHEMATIC_COLOR,
} from "./kicad-sym/defaults"

interface ConvertOptions {
  componentName?: string
}

function formatColor(
  color: { r: number; g: number; b: number; a: number } | undefined,
): string {
  if (color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }
  return DEFAULT_SCHEMATIC_COLOR
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
    const strokeWidth = rect.stroke?.width ?? DEFAULT_STROKE_WIDTH
    lines.push(
      `        <schematicrect schX={${formatNumber(x + width / 2)}} schY={${formatNumber(y + height / 2)}} width={${formatNumber(width)}} height={${formatNumber(height)}} strokeWidth={${formatNumber(strokeWidth)}} />`,
    )
  }

  // Add circles
  for (const circle of symbolData.circles) {
    const center = toSchematicCoord(circle.centerX, circle.centerY)
    const strokeWidth = circle.stroke?.width ?? DEFAULT_STROKE_WIDTH
    lines.push(
      `        <schematiccircle schX={${formatNumber(center.schX)}} schY={${formatNumber(center.schY)}} radius={${formatNumber(circle.radius)}} strokeWidth={${formatNumber(strokeWidth)}} />`,
    )
  }

  // Add polylines as schematicpath
  for (const polyline of symbolData.polylines) {
    if (polyline.points.length < 2) continue

    const pathPoints = polyline.points.map((p) => {
      const coord = toSchematicCoord(p.x, p.y)
      return `{ x: ${formatNumber(coord.schX)}, y: ${formatNumber(coord.schY)} }`
    })
    const strokeWidth = polyline.stroke?.width ?? DEFAULT_STROKE_WIDTH
    lines.push(
      `        <schematicpath points={[${pathPoints.join(", ")}]} strokeWidth={${formatNumber(strokeWidth)}} />`,
    )
  }

  // Add arcs
  for (const arc of symbolData.arcs) {
    const start = toSchematicCoord(arc.startX, arc.startY)
    const end = toSchematicCoord(arc.endX, arc.endY)
    // For arcs, we need to calculate center and angles from start/mid/end points
    // For now, render as a simple path from start to end via mid
    const mid = toSchematicCoord(arc.midX, arc.midY)
    const strokeWidth = arc.stroke?.width ?? DEFAULT_STROKE_WIDTH
    lines.push(
      `        <schematicpath points={[{ x: ${formatNumber(start.schX)}, y: ${formatNumber(start.schY)} }, { x: ${formatNumber(mid.schX)}, y: ${formatNumber(mid.schY)} }, { x: ${formatNumber(end.schX)}, y: ${formatNumber(end.schY)} }]} strokeWidth={${formatNumber(strokeWidth)}} />`,
    )
  }

  // Add lines from pin position to body (pin stubs)
  // And add ports at the end of pins
  for (const pin of symbolData.pins) {
    const pinPos = toSchematicCoord(pin.x, pin.y)
    const direction = getDirectionFromRotation(pin.rotation)
    const length = pin.length

    // Calculate the end point of the pin (where it connects to the body)
    // In KiCad, pin position is at the external tip, body is in the direction the pin points
    let bodyX = pinPos.schX
    let bodyY = pinPos.schY
    switch (direction) {
      case "right":
        bodyX += length
        break
      case "left":
        bodyX -= length
        break
      case "up":
        bodyY += length
        break
      case "down":
        bodyY -= length
        break
    }

    // Draw the pin line
    lines.push(
      `        <schematicline x1={${formatNumber(pinPos.schX)}} y1={${formatNumber(pinPos.schY)}} x2={${formatNumber(bodyX)}} y2={${formatNumber(bodyY)}} strokeWidth={${formatNumber(DEFAULT_STROKE_WIDTH)}} />`,
    )

    // Add the port at the pin tip
    const portName = pin.number || pin.name || "1"
    const pinLabel = pin.name || ""
    const pinNumber = pin.number || ""
    const numberFontSize = pin.numberFontSize ?? DEFAULT_FONT_SIZE
    const nameFontSize = pin.nameFontSize ?? DEFAULT_FONT_SIZE
    lines.push(
      `        <port name="${portName}" schX={${formatNumber(pinPos.schX)}} schY={${formatNumber(pinPos.schY)}} direction="${direction}" pinNumber={${pin.number ? `${pin.number}` : "undefined"}} />`,
    )

    // Add pin number text at the center of the pin line
    if (pinNumber) {
      // Position at midpoint of pin line
      const midX = (pinPos.schX + bodyX) / 2
      const midY = (pinPos.schY + bodyY) / 2
      // Offset slightly perpendicular to the line for readability
      let numX = midX
      let numY = midY
      const perpOffset = 0.8
      switch (direction) {
        case "right":
        case "left":
          numY += perpOffset // Above the horizontal line
          break
        case "up":
        case "down":
          numX += perpOffset // Right of the vertical line
          break
      }
      lines.push(
        `        <schematictext schX={${formatNumber(numX)}} schY={${formatNumber(numY)}} text="${pinNumber}" anchor="center" fontSize={${formatNumber(numberFontSize)}} color="${DEFAULT_SCHEMATIC_COLOR}" />`,
      )
    }

    // Add pin label text inside the body (near the body connection point)
    if (pinLabel) {
      let labelX = bodyX
      let labelY = bodyY
      let anchor = "left"
      const labelOffset = 0.5
      switch (direction) {
        case "right":
          labelX += labelOffset
          anchor = "left"
          break
        case "left":
          labelX -= labelOffset
          anchor = "right"
          break
        case "up":
          labelY += labelOffset
          anchor = "bottom"
          break
        case "down":
          labelY -= labelOffset
          anchor = "top"
          break
      }
      lines.push(
        `        <schematictext schX={${formatNumber(labelX)}} schY={${formatNumber(labelY)}} text="${pinLabel}" anchor="${anchor}" fontSize={${formatNumber(nameFontSize)}} color="${DEFAULT_SCHEMATIC_COLOR}" />`,
      )
    }
  }

  // Add text elements (excluding property texts like reference and value)
  for (const text of symbolData.texts) {
    if (!text.value) continue
    const pos = toSchematicCoord(text.x, text.y)
    const fontSize = text.fontSize ?? DEFAULT_FONT_SIZE
    const color = formatColor(text.color)
    lines.push(
      `        <schematictext schX={${formatNumber(pos.schX)}} schY={${formatNumber(pos.schY)}} text="${text.value.replace(/"/g, '\\"')}" fontSize={${formatNumber(fontSize)}} color="${color}" />`,
    )
  }

  lines.push("      </symbol>")
  lines.push("    }")
  lines.push("  />")
  lines.push(")")
  lines.push("")

  return lines.join("\n")
}
