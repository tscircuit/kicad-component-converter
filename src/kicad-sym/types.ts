import type { AnyCircuitElement } from "circuit-json"

export interface StrokeStyle {
  width?: number
  type?: string // "dash" | "dash_dot" | "dash_dot_dot" | "dot" | "default" | "solid"
  color?: { r: number; g: number; b: number; a: number }
}

export interface ParsedSymbolData {
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
    stroke?: StrokeStyle
    fillType?: string
  }>
  circles: Array<{
    centerX: number
    centerY: number
    radius: number
    stroke?: StrokeStyle
    fillType?: string
  }>
  arcs: Array<{
    startX: number
    startY: number
    midX: number
    midY: number
    endX: number
    endY: number
    stroke?: StrokeStyle
  }>
  polylines: Array<{
    points: Array<{ x: number; y: number }>
    stroke?: StrokeStyle
    fillType?: string
  }>
  texts: Array<{
    value: string
    x: number
    y: number
    rotation?: number
    fontSize?: number
    color?: { r: number; g: number; b: number; a: number }
  }>
}

export interface ParsedKicadSymbol {
  symbolData: ParsedSymbolData
  circuitJson: AnyCircuitElement[]
}
