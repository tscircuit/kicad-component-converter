import type {
  AnyCircuitElement,
  SourceSimpleChip,
  SchematicComponent,
  SchematicLine,
  SchematicBox,
  SourcePort,
  SchematicPort,
  SchematicText,
  SchematicGroup,
  SourceGroup,
} from "circuit-json"
import { getBoundsFromPoints } from "@tscircuit/math-utils"
import type { ParsedSymbolData, StrokeStyle } from "./types"
import { getDirectionFromRotation } from "../utils/get-direction-from-rotation"
import { toSchematicCoord } from "../utils/to-schematic-coord"
import {
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_SCHEMATIC_COLOR,
  isDashedFromStrokeType,
} from "./defaults"

function getStrokeWidth(stroke: StrokeStyle | undefined): number {
  return stroke?.width ?? DEFAULT_STROKE_WIDTH
}

function getColor(stroke: StrokeStyle | undefined): string {
  if (stroke?.color) {
    const { r, g, b } = stroke.color
    return `rgb(${r}, ${g}, ${b})`
  }
  return DEFAULT_SCHEMATIC_COLOR
}

function getIsDashed(stroke: StrokeStyle | undefined): boolean {
  return isDashedFromStrokeType(stroke?.type)
}

export function convertSymbolDataToCircuitJson(
  symbolData: ParsedSymbolData,
): AnyCircuitElement[] {
  const circuitJson: AnyCircuitElement[] = []

  // Collect all points for bounds calculation
  const allPoints: Array<{ x: number; y: number }> = []
  for (const polyline of symbolData.polylines) {
    allPoints.push(...polyline.points)
  }
  for (const rect of symbolData.rectangles) {
    allPoints.push({ x: rect.startX, y: rect.startY })
    allPoints.push({ x: rect.endX, y: rect.endY })
  }
  for (const pin of symbolData.pins) {
    allPoints.push({ x: pin.x, y: pin.y })
  }

  const transformedPoints = allPoints.map((p) => {
    const { schX, schY } = toSchematicCoord(p.x, p.y)
    return { x: schX, y: schY }
  })
  const bounds = getBoundsFromPoints(transformedPoints)
  const { minX, minY, maxX, maxY } = bounds ?? {
    minX: -5,
    minY: -5,
    maxX: 5,
    maxY: 5,
  }

  const width = maxX - minX
  const height = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  // Add source_group for the component
  const sourceGroup: SourceGroup = {
    type: "source_group",
    source_group_id: "source_group_0",
    name: symbolData.name,
  }
  circuitJson.push(sourceGroup)

  const sourceComponent: SourceSimpleChip = {
    type: "source_component",
    source_component_id: "source_component_0",
    source_group_id: "source_group_0",
    name: symbolData.name,
    ftype: "simple_chip",
  }
  circuitJson.push(sourceComponent)

  const schematicComponent: SchematicComponent = {
    type: "schematic_component",
    schematic_component_id: "schematic_component_0",
    source_component_id: "source_component_0",
    center: { x: centerX, y: centerY },
    size: { width: width || 10, height: height || 10 },
    is_box_with_pins: false,
  }
  circuitJson.push(schematicComponent)

  // Add schematic_group to enable schematic view
  const schematicGroup: SchematicGroup = {
    type: "schematic_group",
    schematic_group_id: "schematic_group_0",
    source_group_id: "source_group_0",
    center: { x: centerX, y: centerY },
    width: width || 10,
    height: height || 10,
    schematic_component_ids: ["schematic_component_0"],
  }
  circuitJson.push(schematicGroup)

  let lineIndex = 0

  // Add schematic lines for polylines
  for (const polyline of symbolData.polylines) {
    const strokeWidth = getStrokeWidth(polyline.stroke)
    const color = getColor(polyline.stroke)
    const isDashed = getIsDashed(polyline.stroke)

    for (let i = 0; i < polyline.points.length - 1; i++) {
      const p1 = toSchematicCoord(polyline.points[i].x, polyline.points[i].y)
      const p2 = toSchematicCoord(
        polyline.points[i + 1].x,
        polyline.points[i + 1].y,
      )
      const line: SchematicLine = {
        type: "schematic_line",
        schematic_line_id: `schematic_line_${lineIndex++}`,
        schematic_component_id: "schematic_component_0",
        x1: p1.schX,
        y1: p1.schY,
        x2: p2.schX,
        y2: p2.schY,
        stroke_width: strokeWidth,
        color,
        is_dashed: isDashed,
      }
      circuitJson.push(line)
    }
  }

  // Add schematic boxes for rectangles
  for (let i = 0; i < symbolData.rectangles.length; i++) {
    const rect = symbolData.rectangles[i]
    const p1 = toSchematicCoord(rect.startX, rect.startY)
    const p2 = toSchematicCoord(rect.endX, rect.endY)
    const x = Math.min(p1.schX, p2.schX)
    const y = Math.min(p1.schY, p2.schY)
    const w = Math.abs(p2.schX - p1.schX)
    const h = Math.abs(p2.schY - p1.schY)
    const box: SchematicBox = {
      type: "schematic_box",
      schematic_component_id: "schematic_component_0",
      x: x + w / 2,
      y: y + h / 2,
      width: w,
      height: h,
      is_dashed: getIsDashed(rect.stroke),
    }
    circuitJson.push(box)
  }

  // Add schematic ports for pins
  for (let i = 0; i < symbolData.pins.length; i++) {
    const pin = symbolData.pins[i]
    const pinPos = toSchematicCoord(pin.x, pin.y)
    const direction = getDirectionFromRotation(pin.rotation)
    const length = pin.length

    let bodyX = pinPos.schX
    let bodyY = pinPos.schY
    switch (direction) {
      case "right":
        bodyX = pinPos.schX + length
        break
      case "left":
        bodyX = pinPos.schX - length
        break
      case "up":
        bodyY = pinPos.schY + length
        break
      case "down":
        bodyY = pinPos.schY - length
        break
    }

    // Pin lines use default stroke width and color
    const pinLine: SchematicLine = {
      type: "schematic_line",
      schematic_line_id: `schematic_pin_line_${i}`,
      schematic_component_id: "schematic_component_0",
      x1: pinPos.schX,
      y1: pinPos.schY,
      x2: bodyX,
      y2: bodyY,
      stroke_width: DEFAULT_STROKE_WIDTH,
      color: DEFAULT_SCHEMATIC_COLOR,
      is_dashed: false,
    }
    circuitJson.push(pinLine)

    const sourcePort: SourcePort = {
      type: "source_port",
      source_port_id: `source_port_${i}`,
      source_component_id: "source_component_0",
      source_group_id: "source_group_0",
      name: pin.number || pin.name || `${i + 1}`,
      pin_number: Number.parseInt(pin.number) || i + 1,
    }
    circuitJson.push(sourcePort)

    const schematicPort: SchematicPort = {
      type: "schematic_port",
      schematic_port_id: `schematic_port_${i}`,
      schematic_component_id: "schematic_component_0",
      source_port_id: `source_port_${i}`,
      center: { x: pinPos.schX, y: pinPos.schY },
      facing_direction: direction,
      pin_number: Number.parseInt(pin.number) || i + 1,
      display_pin_label: pin.name || undefined,
    }
    circuitJson.push(schematicPort)

    // Add pin number text at midpoint of pin line
    const pinNumber = pin.number
    if (pinNumber) {
      const midX = (pinPos.schX + bodyX) / 2
      const midY = (pinPos.schY + bodyY) / 2
      // Offset perpendicular to the line for readability
      let numX = midX
      let numY = midY
      const perpOffset = 0.8
      if (direction === "right" || direction === "left") {
        numY += perpOffset
      } else {
        numX += perpOffset
      }
      const pinNumText: SchematicText = {
        type: "schematic_text",
        schematic_text_id: `schematic_pin_num_${i}`,
        text: pinNumber,
        position: { x: numX, y: numY },
        rotation: 0,
        anchor: "center",
        font_size: pin.numberFontSize ?? DEFAULT_FONT_SIZE,
        color: DEFAULT_SCHEMATIC_COLOR,
      }
      circuitJson.push(pinNumText)
    }

    // Add pin label text inside the body near body connection
    const pinLabel = pin.name
    if (pinLabel) {
      let labelX = bodyX
      let labelY = bodyY
      const labelOffset = 0.5
      let anchor: "left" | "right" | "top" | "bottom" | "center" = "left"
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
      const pinLabelText: SchematicText = {
        type: "schematic_text",
        schematic_text_id: `schematic_pin_label_${i}`,
        text: pinLabel,
        position: { x: labelX, y: labelY },
        rotation: 0,
        anchor,
        font_size: pin.nameFontSize ?? DEFAULT_FONT_SIZE,
        color: DEFAULT_SCHEMATIC_COLOR,
      }
      circuitJson.push(pinLabelText)
    }
  }

  // Add schematic text for labels
  for (let i = 0; i < symbolData.texts.length; i++) {
    const text = symbolData.texts[i]
    if (text.value) {
      const pos = toSchematicCoord(text.x, text.y)
      let color = DEFAULT_SCHEMATIC_COLOR
      if (text.color) {
        const { r, g, b } = text.color
        color = `rgb(${r}, ${g}, ${b})`
      }
      const schematicText: SchematicText = {
        type: "schematic_text",
        schematic_text_id: `schematic_text_${i}`,
        text: text.value,
        position: { x: pos.schX, y: pos.schY },
        rotation: text.rotation || 0,
        anchor: "center",
        font_size: text.fontSize ?? DEFAULT_FONT_SIZE,
        color,
      }
      circuitJson.push(schematicText)
    }
  }

  return circuitJson
}
