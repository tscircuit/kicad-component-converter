import type { KicadSymJson, Symbol, SymbolPin } from "./kicad-zod"
import Debug from "debug"

const debug = Debug("kicad-sym-to-schematic")

export interface SchematicPortArrangementBySides {
  left_side?: {
    pins: number[]
    direction?: "top-to-bottom" | "bottom-to-top"
  }
  right_side?: {
    pins: number[]
    direction?: "top-to-bottom" | "bottom-to-top"
  }
  top_side?: {
    pins: number[]
    direction?: "left-to-right" | "right-to-left"
  }
  bottom_side?: {
    pins: number[]
    direction?: "left-to-right" | "right-to-left"
  }
}

export interface SchematicPortArrangementBySize {
  left_size: number
  right_size: number
  top_size?: number
  bottom_size?: number
}

export type SchematicPortArrangement =
  | SchematicPortArrangementBySides
  | SchematicPortArrangementBySize

export interface SchematicInfo {
  schPortArrangement?: SchematicPortArrangement
  pinLabels?: Record<string, string>
  symbolName?: string
  symbolDisplayValue?: string
}

/**
 * Converts a parsed kicad_sym file into schematic information
 * including port arrangement and pin labels
 */
export const convertKicadSymToSchematicInfo = (
  kicadSymJson: KicadSymJson,
): SchematicInfo => {
  // Find the main symbol (usually the first one or the one without unit suffix)
  const mainSymbol = findMainSymbol(kicadSymJson.symbols)

  if (!mainSymbol) {
    debug("No main symbol found")
    return {}
  }

  // Collect all pins from the main symbol and its units
  const allPins = collectAllPins(mainSymbol)

  if (allPins.length === 0) {
    debug("No pins found in symbol")
    return {}
  }

  // Generate pin labels from pin names and numbers
  const pinLabels = generatePinLabels(allPins)

  // Generate port arrangement based on pin positions
  const schPortArrangement = generatePortArrangement(allPins)

  // Extract symbol information
  const symbolName = extractSymbolName(mainSymbol)
  const symbolDisplayValue = extractSymbolDisplayValue(mainSymbol)

  return {
    schPortArrangement,
    pinLabels,
    symbolName,
    symbolDisplayValue,
  }
}

/**
 * Find the main symbol from the list of symbols
 * The main symbol is typically the one that doesn't have a unit suffix (_0_0, _1_1, etc.)
 * or the first symbol if all have unit suffixes
 */
const findMainSymbol = (symbols: Symbol[]): Symbol | null => {
  if (symbols.length === 0) return null

  // Look for a symbol without unit suffix first
  const mainSymbol = symbols.find((symbol) => !symbol.name.includes("_"))
  if (mainSymbol) return mainSymbol

  // If all symbols have unit suffixes, find the base symbol (_0_0)
  const baseSymbol = symbols.find((symbol) => symbol.name.endsWith("_0_0"))
  if (baseSymbol) return baseSymbol

  // Fallback to the first symbol
  return symbols[0]
}

/**
 * Collect all pins from a symbol and its units
 */
const collectAllPins = (symbol: Symbol): SymbolPin[] => {
  const pins: SymbolPin[] = [...symbol.pins]

  // Add pins from units
  if (symbol.units) {
    for (const unit of symbol.units) {
      pins.push(...collectAllPins(unit))
    }
  }

  return pins
}

/**
 * Generate pin labels mapping from pin numbers to pin names
 */
const generatePinLabels = (pins: SymbolPin[]): Record<string, string> => {
  const pinLabels: Record<string, string> = {}

  for (const pin of pins) {
    if (pin.number && pin.name) {
      pinLabels[pin.number] = pin.name
    }
  }

  return pinLabels
}

/**
 * Generate port arrangement based on pin positions
 * This analyzes the pin positions to determine which side of the symbol they're on
 */
const generatePortArrangement = (
  pins: SymbolPin[],
): SchematicPortArrangement => {
  if (pins.length === 0) {
    return { left_size: 0, right_size: 0 }
  }

  // Analyze pin positions to determine sides
  const pinsBySide = categorizePinsBySide(pins)

  // If we have clear side categorization, use sides-based arrangement
  if (hasMultipleSides(pinsBySide)) {
    return generateSidesArrangement(pinsBySide)
  }

  // Otherwise, use size-based arrangement
  return generateSizeArrangement(pins)
}

interface PinsBySide {
  left: SymbolPin[]
  right: SymbolPin[]
  top: SymbolPin[]
  bottom: SymbolPin[]
}

/**
 * Categorize pins by which side of the symbol they're on
 * based on their position and rotation
 */
const categorizePinsBySide = (pins: SymbolPin[]): PinsBySide => {
  const sides: PinsBySide = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }

  for (const pin of pins) {
    const [x, y, rotation = 0] = pin.at

    // Determine side based on rotation (pin direction)
    // In KiCad, pin rotation indicates the direction the pin points
    // 0° = right, 90° = up, 180° = left, 270° = down
    const normalizedRotation = ((rotation % 360) + 360) % 360

    if (normalizedRotation === 0) {
      // Pin points right, so it's on the left side of the symbol
      sides.left.push(pin)
    } else if (normalizedRotation === 90) {
      // Pin points up, so it's on the bottom side of the symbol
      sides.bottom.push(pin)
    } else if (normalizedRotation === 180) {
      // Pin points left, so it's on the right side of the symbol
      sides.right.push(pin)
    } else if (normalizedRotation === 270) {
      // Pin points down, so it's on the top side of the symbol
      sides.top.push(pin)
    } else {
      // For non-standard rotations, use position to guess
      // This is a fallback and may not be accurate
      if (x < 0) sides.left.push(pin)
      else if (x > 0) sides.right.push(pin)
      else if (y > 0) sides.top.push(pin)
      else sides.bottom.push(pin)
    }
  }

  return sides
}

/**
 * Check if pins are distributed across multiple sides
 */
const hasMultipleSides = (pinsBySide: PinsBySide): boolean => {
  const sidesWithPins = [
    pinsBySide.left.length > 0,
    pinsBySide.right.length > 0,
    pinsBySide.top.length > 0,
    pinsBySide.bottom.length > 0,
  ].filter(Boolean).length

  return sidesWithPins > 1
}

/**
 * Generate sides-based port arrangement
 */
const generateSidesArrangement = (
  pinsBySide: PinsBySide,
): SchematicPortArrangementBySides => {
  const arrangement: SchematicPortArrangementBySides = {}

  if (pinsBySide.left.length > 0) {
    arrangement.left_side = {
      pins: pinsBySide.left
        .map((pin) => Number.parseInt(pin.number) || 0)
        .filter((n) => n > 0),
      direction: "top-to-bottom",
    }
  }

  if (pinsBySide.right.length > 0) {
    arrangement.right_side = {
      pins: pinsBySide.right
        .map((pin) => Number.parseInt(pin.number) || 0)
        .filter((n) => n > 0),
      direction: "top-to-bottom",
    }
  }

  if (pinsBySide.top.length > 0) {
    arrangement.top_side = {
      pins: pinsBySide.top
        .map((pin) => Number.parseInt(pin.number) || 0)
        .filter((n) => n > 0),
      direction: "left-to-right",
    }
  }

  if (pinsBySide.bottom.length > 0) {
    arrangement.bottom_side = {
      pins: pinsBySide.bottom
        .map((pin) => Number.parseInt(pin.number) || 0)
        .filter((n) => n > 0),
      direction: "left-to-right",
    }
  }

  return arrangement
}

/**
 * Generate size-based port arrangement
 * This is a fallback when pins aren't clearly on different sides
 */
const generateSizeArrangement = (
  pins: SymbolPin[],
): SchematicPortArrangementBySize => {
  const totalPins = pins.length

  // Simple heuristic: distribute pins evenly between left and right
  // For more complex symbols, this could be improved
  const leftSize = Math.ceil(totalPins / 2)
  const rightSize = totalPins - leftSize

  return {
    left_size: leftSize,
    right_size: rightSize,
  }
}

/**
 * Extract symbol name from properties
 */
const extractSymbolName = (symbol: Symbol): string | undefined => {
  const valueProperty = symbol.properties.find(
    (prop: any) => prop.key === "Value",
  )
  return valueProperty?.value || symbol.name
}

/**
 * Extract symbol display value from properties
 */
const extractSymbolDisplayValue = (symbol: Symbol): string | undefined => {
  const valueProperty = symbol.properties.find(
    (prop: any) => prop.key === "Value",
  )
  return valueProperty?.value
}
