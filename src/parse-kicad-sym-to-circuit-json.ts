import type { AnyCircuitElement } from "circuit-json"
import {
  parseKicadSexpr,
  KicadSymbolLib,
  type SchematicSymbol,
  type SymbolPin,
  type SymbolRectangle,
  type SymbolCircle,
  type SymbolArc,
  type SymbolPolyline,
  type SymbolText,
} from "kicadts"

interface ParsedSymbolData {
  name: string
  pins: Array<{
    name: string
    number: string
    x: number
    y: number
    length: number
    rotation: number
    electricalType?: string
  }>
  rectangles: Array<{
    startX: number
    startY: number
    endX: number
    endY: number
  }>
  circles: Array<{
    centerX: number
    centerY: number
    radius: number
  }>
  arcs: Array<{
    startX: number
    startY: number
    midX: number
    midY: number
    endX: number
    endY: number
  }>
  polylines: Array<{
    points: Array<{ x: number; y: number }>
  }>
  texts: Array<{
    value: string
    x: number
    y: number
    rotation?: number
  }>
}

function extractSymbolData(symbol: SchematicSymbol): ParsedSymbolData {
  const name =
    symbol.libraryId?.replace(/.*:/, "") || symbol.properties?.[0]?.value || "Unknown"

  // Get all graphical elements including from subSymbols
  const allPins: SymbolPin[] = [...symbol.pins]
  const allRectangles: SymbolRectangle[] = [...symbol.rectangles]
  const allCircles: SymbolCircle[] = [...symbol.circles]
  const allArcs: SymbolArc[] = [...symbol.arcs]
  const allPolylines: SymbolPolyline[] = [...symbol.polylines]
  const allTexts: SymbolText[] = [...symbol.texts]

  // Collect from subSymbols (units)
  for (const subSymbol of symbol.subSymbols) {
    allPins.push(...subSymbol.pins)
    allRectangles.push(...subSymbol.rectangles)
    allCircles.push(...subSymbol.circles)
    allArcs.push(...subSymbol.arcs)
    allPolylines.push(...subSymbol.polylines)
    allTexts.push(...subSymbol.texts)
  }

  const pins = allPins.map((pin) => ({
    name: pin.name || "",
    number: pin.numberString || "",
    x: pin.at?.x || 0,
    y: pin.at?.y || 0,
    length: pin.length || 2.54,
    rotation: pin.at?.angle || 0,
    electricalType: pin.pinElectricalType,
  }))

  const rectangles = allRectangles.map((rect) => {
    const children = rect.getChildren()
    const startChild = children.find((c) => c.token === "start") as any
    const endChild = children.find((c) => c.token === "end") as any
    return {
      startX: startChild?.x || 0,
      startY: startChild?.y || 0,
      endX: endChild?.x || 0,
      endY: endChild?.y || 0,
    }
  })

  const circles = allCircles.map((circle) => {
    const children = circle.getChildren()
    const centerChild = children.find((c) => c.token === "center") as any
    const radiusChild = children.find((c) => c.token === "radius") as any
    return {
      centerX: centerChild?.x || 0,
      centerY: centerChild?.y || 0,
      radius: radiusChild?.value || 0,
    }
  })

  const arcs = allArcs.map((arc) => {
    const children = arc.getChildren()
    const startChild = children.find((c) => c.token === "start") as any
    const midChild = children.find((c) => c.token === "mid") as any
    const endChild = children.find((c) => c.token === "end") as any
    return {
      startX: startChild?.x || 0,
      startY: startChild?.y || 0,
      midX: midChild?.x || 0,
      midY: midChild?.y || 0,
      endX: endChild?.x || 0,
      endY: endChild?.y || 0,
    }
  })

  const polylines = allPolylines.map((polyline) => {
    const pts = polyline.points
    const points: Array<{ x: number; y: number }> = []
    if (pts) {
      for (const pt of pts.points) {
        if ("x" in pt && "y" in pt) {
          points.push({ x: pt.x, y: pt.y })
        }
      }
    }
    return { points }
  })

  const texts = allTexts.map((text) => ({
    value: text.value || "",
    x: text.at?.x || 0,
    y: text.at?.y || 0,
    rotation: text.at?.angle,
  }))

  return {
    name,
    pins,
    rectangles,
    circles,
    arcs,
    polylines,
    texts,
  }
}

export interface ParsedKicadSymbol {
  symbolData: ParsedSymbolData
  circuitJson: AnyCircuitElement[]
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<ParsedKicadSymbol[]> => {
  const parsed = parseKicadSexpr(kicadSym)
  const symbolLib = parsed.find(
    (item) => item instanceof KicadSymbolLib,
  ) as KicadSymbolLib

  if (!symbolLib) {
    throw new Error("No KicadSymbolLib found in the file")
  }

  const results: ParsedKicadSymbol[] = []

  for (const symbol of symbolLib.symbols) {
    const symbolData = extractSymbolData(symbol)

    // Generate minimal circuit-json for preview
    // For symbols, we create schematic elements
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "source_component_0",
        name: symbolData.name,
        ftype: "simple_chip",
      } as unknown as AnyCircuitElement,
      {
        type: "schematic_component",
        schematic_component_id: "schematic_component_0",
        source_component_id: "source_component_0",
        center: { x: 0, y: 0 },
        rotation: 0,
        size: { width: 10, height: 10 },
        is_box_with_pins: true,
      } as unknown as AnyCircuitElement,
    ]

    // Add schematic ports for pins
    for (let i = 0; i < symbolData.pins.length; i++) {
      const pin = symbolData.pins[i]
      circuitJson.push({
        type: "source_port",
        source_port_id: `source_port_${i}`,
        source_component_id: "source_component_0",
        name: pin.number || pin.name || `${i + 1}`,
        pin_number: Number.parseInt(pin.number) || i + 1,
      } as unknown as AnyCircuitElement)

      circuitJson.push({
        type: "schematic_port",
        schematic_port_id: `schematic_port_${i}`,
        schematic_component_id: "schematic_component_0",
        source_port_id: `source_port_${i}`,
        center: { x: pin.x, y: -pin.y }, // Flip Y for tscircuit coordinates
        facing_direction: getDirectionFromRotation(pin.rotation),
      } as unknown as AnyCircuitElement)
    }

    results.push({ symbolData, circuitJson })
  }

  return results
}

function getDirectionFromRotation(
  rotation: number,
): "up" | "down" | "left" | "right" {
  // KiCad pin rotation: 0° points right, 90° points up, 180° points left, 270° points down
  // The direction represents which way the pin points (where it connects externally)
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized >= 315 || normalized < 45) return "right"
  if (normalized >= 45 && normalized < 135) return "up"
  if (normalized >= 135 && normalized < 225) return "left"
  return "down"
}
