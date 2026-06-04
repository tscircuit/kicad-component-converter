import {
  parseKicadSymToKicadJson,
  type KicadSymPin,
  type KicadSymPinSide,
  type KicadSymSymbol,
} from "./parse-kicad-sym-to-kicad-json"

export type SchematicPinSideDirection =
  | "top-to-bottom"
  | "left-to-right"
  | "bottom-to-top"
  | "right-to-left"

export interface SchematicPinSideDefinition {
  pins: Array<number | string>
  direction: SchematicPinSideDirection
}

/**
 * Matches `@tscircuit/props`' `SchematicPortArrangementWithSides`, the shape
 * accepted by the `schPortArrangement` prop on a tscircuit `<chip />`.
 */
export interface SchematicPortArrangement {
  leftSide?: SchematicPinSideDefinition
  rightSide?: SchematicPinSideDefinition
  topSide?: SchematicPinSideDefinition
  bottomSide?: SchematicPinSideDefinition
}

export interface KicadSymSchematic {
  name: string
  /** Maps `pin{number}` to the pin's human-readable name, e.g. `{ pin1: "VCC" }`. */
  pinLabels: Record<string, string>
  /** Side/ordering of pins, suitable for a tscircuit `<chip schPortArrangement={...} />`. */
  schPortArrangement: SchematicPortArrangement
}

/** Pin numbers are emitted as numbers when numeric, otherwise kept as strings. */
const normalizePinNumber = (pinNumber: string): number | string => {
  if (/^\d+$/.test(pinNumber)) return Number.parseInt(pinNumber, 10)
  return pinNumber
}

const buildSide = (
  pins: KicadSymPin[],
  side: KicadSymPinSide,
): SchematicPinSideDefinition | undefined => {
  if (pins.length === 0) return undefined

  // Left/right pins read top-to-bottom (descending y).
  // Top/bottom pins read left-to-right (ascending x).
  const sorted = [...pins].sort((a, b) =>
    side === "left" || side === "right" ? b.y - a.y : a.x - b.x,
  )

  const direction: SchematicPinSideDirection =
    side === "left" || side === "right" ? "top-to-bottom" : "left-to-right"

  return {
    pins: sorted.map((pin) => normalizePinNumber(pin.number)),
    direction,
  }
}

/** Convert a single parsed KiCad symbol into pinLabels + schPortArrangement. */
export const convertKicadSymbolToSchematic = (
  symbol: KicadSymSymbol,
): KicadSymSchematic => {
  const pinLabels: Record<string, string> = {}
  for (const pin of symbol.pins) {
    // KiCad uses "~" for an unnamed pin; skip those (no useful label).
    if (pin.name && pin.name !== "~" && pin.number) {
      pinLabels[`pin${pin.number}`] = pin.name
    }
  }

  const bySide: Record<KicadSymPinSide, KicadSymPin[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }
  for (const pin of symbol.pins) bySide[pin.side].push(pin)

  const schPortArrangement: SchematicPortArrangement = {}
  const left = buildSide(bySide.left, "left")
  const right = buildSide(bySide.right, "right")
  const top = buildSide(bySide.top, "top")
  const bottom = buildSide(bySide.bottom, "bottom")
  if (left) schPortArrangement.leftSide = left
  if (right) schPortArrangement.rightSide = right
  if (top) schPortArrangement.topSide = top
  if (bottom) schPortArrangement.bottomSide = bottom

  return { name: symbol.name, pinLabels, schPortArrangement }
}

/**
 * Convert the contents of a `.kicad_sym` file into schematic information
 * (`pinLabels` and `schPortArrangement`) for each symbol it contains.
 */
export const convertKicadSymToSchematic = (
  fileContent: string,
): KicadSymSchematic[] =>
  parseKicadSymToKicadJson(fileContent).map(convertKicadSymbolToSchematic)
