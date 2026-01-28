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
    nameFontSize?: number
    numberFontSize?: number
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

  const pins = allPins.map((pin) => {
    // Extract font sizes from pin children
    const children = pin.getChildren?.() || []
    const nameChild = children.find((c: any) => c.token === "name") as any
    const numberChild = children.find((c: any) => c.token === "number") as any
    const nameFontSize = nameChild?.effects?.font?.size?.height
    const numberFontSize = numberChild?.effects?.font?.size?.height

    return {
      name: pin.name || "",
      number: pin.numberString || "",
      x: pin.at?.x || 0,
      y: pin.at?.y || 0,
      length: pin.length || 2.54,
      rotation: pin.at?.angle || 0,
      electricalType: pin.pinElectricalType,
      nameFontSize,
      numberFontSize,
    }
  })

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

    // Calculate bounds for the schematic component size
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    // Include polyline points in bounds
    for (const polyline of symbolData.polylines) {
      for (const pt of polyline.points) {
        minX = Math.min(minX, pt.x)
        minY = Math.min(minY, pt.y)
        maxX = Math.max(maxX, pt.x)
        maxY = Math.max(maxY, pt.y)
      }
    }

    // Include rectangles in bounds
    for (const rect of symbolData.rectangles) {
      minX = Math.min(minX, rect.startX, rect.endX)
      minY = Math.min(minY, rect.startY, rect.endY)
      maxX = Math.max(maxX, rect.startX, rect.endX)
      maxY = Math.max(maxY, rect.startY, rect.endY)
    }

    // Include pin positions in bounds
    for (const pin of symbolData.pins) {
      minX = Math.min(minX, pin.x)
      minY = Math.min(minY, pin.y)
      maxX = Math.max(maxX, pin.x)
      maxY = Math.max(maxY, pin.y)
    }

    // Default bounds if nothing found
    if (!isFinite(minX)) {
      minX = -5
      minY = -5
      maxX = 5
      maxY = 5
    }

    const width = maxX - minX
    const height = maxY - minY
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Generate circuit-json with actual symbol graphics
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
        center: { x: centerX, y: centerY },
        rotation: 0,
        size: { width: width || 10, height: height || 10 },
      } as unknown as AnyCircuitElement,
    ]

    let lineIndex = 0

    // Add schematic lines for polylines
    for (const polyline of symbolData.polylines) {
      for (let i = 0; i < polyline.points.length - 1; i++) {
        const p1 = polyline.points[i]
        const p2 = polyline.points[i + 1]
        circuitJson.push({
          type: "schematic_line",
          schematic_line_id: `schematic_line_${lineIndex++}`,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
        } as unknown as AnyCircuitElement)
      }
    }

    // Add schematic boxes for rectangles
    for (let i = 0; i < symbolData.rectangles.length; i++) {
      const rect = symbolData.rectangles[i]
      const x = Math.min(rect.startX, rect.endX)
      const y = Math.min(rect.startY, rect.endY)
      const w = Math.abs(rect.endX - rect.startX)
      const h = Math.abs(rect.endY - rect.startY)
      circuitJson.push({
        type: "schematic_box",
        schematic_box_id: `schematic_box_${i}`,
        x: x + w / 2,
        y: y + h / 2,
        width: w,
        height: h,
      } as unknown as AnyCircuitElement)
    }

    // Add schematic ports for pins with pin lines
    for (let i = 0; i < symbolData.pins.length; i++) {
      const pin = symbolData.pins[i]
      const pinX = pin.x
      const pinY = pin.y
      const direction = getDirectionFromRotation(pin.rotation)
      const length = pin.length

      // Calculate the body connection point
      // In KiCad, pin position is at the tip (external connection point)
      // The body connection is in the direction the pin points
      let bodyX = pinX
      let bodyY = pinY
      switch (direction) {
        case "right":
          bodyX = pinX + length
          break
        case "left":
          bodyX = pinX - length
          break
        case "up":
          bodyY = pinY + length
          break
        case "down":
          bodyY = pinY - length
          break
      }

      // Add line from pin tip to body
      circuitJson.push({
        type: "schematic_line",
        schematic_line_id: `schematic_pin_line_${i}`,
        x1: pinX,
        y1: pinY,
        x2: bodyX,
        y2: bodyY,
      } as unknown as AnyCircuitElement)

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
        center: { x: pinX, y: pinY },
        facing_direction: direction,
      } as unknown as AnyCircuitElement)
    }

    // Add schematic text for labels
    for (let i = 0; i < symbolData.texts.length; i++) {
      const text = symbolData.texts[i]
      if (text.value) {
        circuitJson.push({
          type: "schematic_text",
          schematic_text_id: `schematic_text_${i}`,
          schematic_component_id: "schematic_component_0",
          text: text.value,
          position: { x: text.x, y: text.y },
          rotation: text.rotation || 0,
          anchor: "center",
        } as unknown as AnyCircuitElement)
      }
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