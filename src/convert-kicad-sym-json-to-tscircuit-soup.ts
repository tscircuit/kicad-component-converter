import type { KicadSymJson, KicadSymLibJson } from "./kicad-zod"
import type { AnyCircuitElement } from "circuit-json"
import Debug from "debug"

const debug = Debug("kicad-sym-converter")

// KiCad symbol coordinates use mm, and Y-axis is inverted (positive Y is down in KiCad)
// tscircuit schematic coordinates use mm with Y-axis positive up

const degToRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Convert pin angle from KiCad to tscircuit schematic direction
 * KiCad angles: 0 = right, 90 = up, 180 = left, 270 = down
 * tscircuit side: "left", "right", "top", "bottom" - this is where the pin connects from
 */
const convertPinAngleToSide = (
  angle: number,
): "left" | "right" | "top" | "bottom" => {
  const normalized = ((angle % 360) + 360) % 360
  // Pin angle points outward from the symbol body
  // So a pin at angle 0 (pointing right) connects from the right side
  if (normalized === 0) return "right"
  if (normalized === 90) return "top"
  if (normalized === 180) return "left"
  if (normalized === 270) return "bottom"
  // Default to right for non-standard angles
  return "right"
}

/**
 * Convert KiCad symbol JSON to tscircuit Circuit JSON elements
 * This produces schematic-focused Circuit JSON
 */
export const convertKicadSymJsonToTsCircuitSoup = async (
  kicadSymJson: KicadSymJson,
): Promise<AnyCircuitElement[]> => {
  const { properties, pins, polylines, rectangles, circles, arcs, texts } =
    kicadSymJson

  const circuitJson: AnyCircuitElement[] = []

  // Get symbol metadata from properties
  const refProp = properties.find((p) => p.key === "Reference")
  const valueProp = properties.find((p) => p.key === "Value")
  const footprintProp = properties.find((p) => p.key === "Footprint")
  const datasheetProp = properties.find((p) => p.key === "Datasheet")
  const descriptionProp = properties.find((p) => p.key === "Description")

  const symbolName = kicadSymJson.symbol_name
  const referencePrefix = refProp?.value || "U"
  const value = valueProp?.value || symbolName

  // Create source component
  circuitJson.push({
    type: "source_component",
    source_component_id: "source_component_0",
    name: symbolName,
    supplier_part_numbers: {},
  } as any)

  // Calculate bounding box from graphical elements for schematic component size
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const updateBounds = (x: number, y: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  // Process rectangles for bounds
  if (rectangles) {
    for (const rect of rectangles) {
      updateBounds(rect.start[0], -rect.start[1])
      updateBounds(rect.end[0], -rect.end[1])
    }
  }

  // Process polylines for bounds
  if (polylines) {
    for (const polyline of polylines) {
      for (const pt of polyline.pts) {
        updateBounds(pt[0], -pt[1])
      }
    }
  }

  // Process circles for bounds
  if (circles) {
    for (const circle of circles) {
      updateBounds(circle.center[0] - circle.radius, -circle.center[1])
      updateBounds(circle.center[0] + circle.radius, -circle.center[1])
      updateBounds(circle.center[0], -circle.center[1] - circle.radius)
      updateBounds(circle.center[0], -circle.center[1] + circle.radius)
    }
  }

  // Process arcs for bounds
  if (arcs) {
    for (const arc of arcs) {
      updateBounds(arc.start[0], -arc.start[1])
      updateBounds(arc.mid[0], -arc.mid[1])
      updateBounds(arc.end[0], -arc.end[1])
    }
  }

  // Process pins for bounds
  for (const pin of pins) {
    const pinX = pin.at[0]
    const pinY = -pin.at[1]
    updateBounds(pinX, pinY)
  }

  // Default size if no graphical elements found
  const width = Number.isFinite(minX) ? maxX - minX : 10
  const height = Number.isFinite(minY) ? maxY - minY : 10
  const centerX = Number.isFinite(minX) ? (minX + maxX) / 2 : 0
  const centerY = Number.isFinite(minY) ? (minY + maxY) / 2 : 0

  // Create schematic component
  circuitJson.push({
    type: "schematic_component",
    schematic_component_id: "schematic_component_0",
    source_component_id: "source_component_0",
    center: { x: centerX, y: centerY },
    rotation: 0,
    size: { width: width || 10, height: height || 10 },
    symbol_name: symbolName,
  } as any)

  // Create source_port and schematic_port for each pin
  const portNameToSourcePortId = new Map<string, string>()
  let sourcePortId = 0

  for (const pin of pins) {
    const source_port_id = `source_port_${sourcePortId}`
    const schematic_port_id = `schematic_port_${sourcePortId}`
    sourcePortId++

    const portName = pin.name || pin.number
    portNameToSourcePortId.set(portName, source_port_id)

    // Parse pin number
    const pinNumber = Number.parseInt(pin.number)
    const pinNumberValid = !Number.isNaN(pinNumber) ? pinNumber : undefined

    // Create source port
    circuitJson.push({
      type: "source_port",
      source_port_id,
      source_component_id: "source_component_0",
      name: portName,
      port_hints: [portName, pin.number],
      pin_number: pinNumberValid,
    } as any)

    // Convert pin position (KiCad Y is inverted)
    const pinX = pin.at[0]
    const pinY = -pin.at[1]

    // Determine pin side based on angle
    const side = convertPinAngleToSide(pin.angle)

    // Create schematic port
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id,
      source_port_id,
      schematic_component_id: "schematic_component_0",
      center: { x: pinX, y: pinY },
      side,
      pin_number: pinNumberValid,
      facing_direction:
        side === "left"
          ? "right"
          : side === "right"
            ? "left"
            : side === "top"
              ? "down"
              : "up",
    } as any)
  }

  // Create schematic drawing elements for graphical shapes
  let pathId = 0
  let boxId = 0
  let textId = 0

  // Convert rectangles to schematic boxes
  if (rectangles) {
    for (const rect of rectangles) {
      const x1 = rect.start[0]
      const y1 = -rect.start[1]
      const x2 = rect.end[0]
      const y2 = -rect.end[1]

      circuitJson.push({
        type: "schematic_box",
        schematic_box_id: `schematic_box_${boxId++}`,
        schematic_component_id: "schematic_component_0",
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      } as any)
    }
  }

  // Convert polylines to schematic paths
  if (polylines) {
    for (const polyline of polylines) {
      if (polyline.pts.length < 2) continue

      const points = polyline.pts.map((pt) => ({
        x: pt[0],
        y: -pt[1],
      }))

      circuitJson.push({
        type: "schematic_path",
        schematic_path_id: `schematic_path_${pathId++}`,
        schematic_component_id: "schematic_component_0",
        points,
        is_filled: polyline.fill?.type === "background",
        fill_color:
          polyline.fill?.type === "background" ? "primary" : undefined,
      } as any)
    }
  }

  // Convert circles to schematic paths (approximated as polygons)
  if (circles) {
    for (const circle of circles) {
      const numPoints = Math.max(16, Math.ceil(2 * Math.PI * circle.radius))
      const points: Array<{ x: number; y: number }> = []

      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI
        points.push({
          x: circle.center[0] + circle.radius * Math.cos(angle),
          y: -circle.center[1] + circle.radius * Math.sin(angle),
        })
      }

      circuitJson.push({
        type: "schematic_path",
        schematic_path_id: `schematic_path_${pathId++}`,
        schematic_component_id: "schematic_component_0",
        points,
        is_filled: circle.fill?.type === "background",
        fill_color: circle.fill?.type === "background" ? "primary" : undefined,
      } as any)
    }
  }

  // Convert arcs to schematic paths
  if (arcs) {
    for (const arc of arcs) {
      // Generate arc points using the 3-point arc method
      const start = { x: arc.start[0], y: -arc.start[1] }
      const mid = { x: arc.mid[0], y: -arc.mid[1] }
      const end = { x: arc.end[0], y: -arc.end[1] }

      // Calculate arc points (simplified - could use arc-utils for better accuracy)
      const points = [start, mid, end]

      circuitJson.push({
        type: "schematic_path",
        schematic_path_id: `schematic_path_${pathId++}`,
        schematic_component_id: "schematic_component_0",
        points,
        is_filled: arc.fill?.type === "background",
        fill_color: arc.fill?.type === "background" ? "primary" : undefined,
      } as any)
    }
  }

  // Convert text elements
  if (texts) {
    for (const text of texts) {
      const x = text.at?.[0] ?? 0
      const y = text.at ? -text.at[1] : 0

      circuitJson.push({
        type: "schematic_text",
        schematic_text_id: `schematic_text_${textId++}`,
        schematic_component_id: "schematic_component_0",
        text: text.text,
        anchor: { x, y },
        rotation: 0,
      } as any)
    }
  }

  return circuitJson
}

/**
 * Convert a KiCad symbol library JSON to tscircuit Circuit JSON
 * Returns Circuit JSON for all symbols in the library
 */
export const convertKicadSymLibJsonToTsCircuitSoup = async (
  kicadSymLibJson: KicadSymLibJson,
): Promise<AnyCircuitElement[]> => {
  const allCircuitJson: AnyCircuitElement[] = []

  for (const symbol of kicadSymLibJson.symbols) {
    const symbolCircuitJson = await convertKicadSymJsonToTsCircuitSoup(symbol)
    allCircuitJson.push(...symbolCircuitJson)
  }

  return allCircuitJson
}
