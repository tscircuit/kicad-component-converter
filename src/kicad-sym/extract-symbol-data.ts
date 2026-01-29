import {
  type SchematicSymbol,
  type SymbolPin,
  type SymbolRectangle,
  type SymbolCircle,
  type SymbolArc,
  type SymbolPolyline,
  type SymbolText,
  SymbolRectangleStart,
  SymbolRectangleEnd,
  SymbolCircleCenter,
  SymbolCircleRadius,
  SymbolArcStart,
  SymbolArcMid,
  SymbolArcEnd,
  SymbolPinName,
  SymbolPinNumber,
} from "kicadts"
import type { ParsedSymbolData, StrokeStyle } from "./types"

function extractStroke(stroke: any): StrokeStyle | undefined {
  if (!stroke) return undefined
  return {
    width: stroke.width,
    type: stroke.type,
    color: stroke.color,
  }
}

export function extractSymbolData(symbol: SchematicSymbol): ParsedSymbolData {
  const name =
    symbol.libraryId?.replace(/.*:/, "") ||
    symbol.properties?.[0]?.value ||
    "Unknown"

  const allPins: SymbolPin[] = [...symbol.pins]
  const allRectangles: SymbolRectangle[] = [...symbol.rectangles]
  const allCircles: SymbolCircle[] = [...symbol.circles]
  const allArcs: SymbolArc[] = [...symbol.arcs]
  const allPolylines: SymbolPolyline[] = [...symbol.polylines]
  const allTexts: SymbolText[] = [...symbol.texts]

  for (const subSymbol of symbol.subSymbols) {
    allPins.push(...subSymbol.pins)
    allRectangles.push(...subSymbol.rectangles)
    allCircles.push(...subSymbol.circles)
    allArcs.push(...subSymbol.arcs)
    allPolylines.push(...subSymbol.polylines)
    allTexts.push(...subSymbol.texts)
  }

  const pins = allPins.map((pin) => {
    const children = pin.getChildren?.() || []
    const nameChild = children.find(
      (c): c is SymbolPinName => c instanceof SymbolPinName,
    )
    const numberChild = children.find(
      (c): c is SymbolPinNumber => c instanceof SymbolPinNumber,
    )
    return {
      name: pin.name || "",
      number: pin.numberString || "",
      x: pin.at?.x || 0,
      y: pin.at?.y || 0,
      length: pin.length || 2.54,
      rotation: pin.at?.angle || 0,
      electricalType: pin.pinElectricalType,
      nameFontSize: nameChild?.effects?.font?.size?.height,
      numberFontSize: numberChild?.effects?.font?.size?.height,
    }
  })

  const rectangles = allRectangles.map((rect) => {
    const children = rect.getChildren()
    const startChild = children.find(
      (c): c is SymbolRectangleStart => c instanceof SymbolRectangleStart,
    )
    const endChild = children.find(
      (c): c is SymbolRectangleEnd => c instanceof SymbolRectangleEnd,
    )
    return {
      startX: startChild?.x ?? 0,
      startY: startChild?.y ?? 0,
      endX: endChild?.x ?? 0,
      endY: endChild?.y ?? 0,
      stroke: extractStroke((rect as any).stroke),
      fillType: (rect as any).fill?.type,
    }
  })

  const circles = allCircles.map((circle) => {
    const children = circle.getChildren()
    const centerChild = children.find(
      (c): c is SymbolCircleCenter => c instanceof SymbolCircleCenter,
    )
    const radiusChild = children.find(
      (c): c is SymbolCircleRadius => c instanceof SymbolCircleRadius,
    )
    return {
      centerX: centerChild?.x ?? 0,
      centerY: centerChild?.y ?? 0,
      radius: radiusChild?.value ?? 0,
      stroke: extractStroke((circle as any).stroke),
      fillType: (circle as any).fill?.type,
    }
  })

  const arcs = allArcs.map((arc) => {
    const children = arc.getChildren()
    const startChild = children.find(
      (c): c is SymbolArcStart => c instanceof SymbolArcStart,
    )
    const midChild = children.find(
      (c): c is SymbolArcMid => c instanceof SymbolArcMid,
    )
    const endChild = children.find(
      (c): c is SymbolArcEnd => c instanceof SymbolArcEnd,
    )
    return {
      startX: startChild?.x ?? 0,
      startY: startChild?.y ?? 0,
      midX: midChild?.x ?? 0,
      midY: midChild?.y ?? 0,
      endX: endChild?.x ?? 0,
      endY: endChild?.y ?? 0,
      stroke: extractStroke((arc as any).stroke),
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
    return {
      points,
      stroke: extractStroke(polyline.stroke),
      fillType: polyline.fill?.type,
    }
  })

  const texts = allTexts.map((text) => ({
    value: text.value || "",
    x: text.at?.x || 0,
    y: text.at?.y || 0,
    rotation: text.at?.angle,
    fontSize: text.effects?.font?.size?.height,
    color: (text as any).effects?.font?.color,
  }))

  return { name, pins, rectangles, circles, arcs, polylines, texts }
}
