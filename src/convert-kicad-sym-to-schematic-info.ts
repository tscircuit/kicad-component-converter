import type { KicadSymJson, SymbolPin } from "./kicad-zod"

export interface SchematicInfo {
  schPortArrangement: Record<string, string[]>
  pinLabels: Record<string, string>
  symbolName: string
  symbolDisplayValue: string
}

const getAllPins = (symbols: KicadSymJson["symbols"]): SymbolPin[] => {
  const pins: SymbolPin[] = []
  for (const sym of symbols) {
    pins.push(...sym.pins)
    for (const unit of sym.units) {
      pins.push(...unit.pins)
    }
  }
  return pins
}

const getPinSide = (
  at: number[],
): "left_side" | "right_side" | "top_side" | "bottom_side" => {
  const rotation = at[2] ?? 0
  const normalised = ((rotation % 360) + 360) % 360
  // KiCad pin rotation indicates the direction the pin line points:
  //   0   = points right  -> pin is on the LEFT side of the symbol body
  //   90  = points up     -> pin is on the BOTTOM side
  //   180 = points left   -> pin is on the RIGHT side
  //   270 = points down   -> pin is on the TOP side
  if (normalised === 0) return "left_side"
  if (normalised === 90) return "bottom_side"
  if (normalised === 180) return "right_side"
  return "top_side"
}

export const convertKicadSymToSchematicInfo = (
  symJson: KicadSymJson,
): SchematicInfo => {
  const mainSymbol = symJson.symbols[0]
  if (!mainSymbol) {
    return {
      schPortArrangement: {},
      pinLabels: {},
      symbolName: "",
      symbolDisplayValue: "",
    }
  }

  const allPins = getAllPins([mainSymbol])

  const arrangement: Record<string, string[]> = {
    left_side: [],
    right_side: [],
    top_side: [],
    bottom_side: [],
  }

  const pinLabels: Record<string, string> = {}

  for (const pin of allPins) {
    const side = getPinSide(pin.at)
    arrangement[side].push(pin.number)
    if (pin.name && pin.name !== "~" && pin.name !== "") {
      pinLabels[pin.number] = pin.name
    }
  }

  // Remove empty sides
  for (const side of Object.keys(arrangement)) {
    if (arrangement[side].length === 0) {
      delete arrangement[side]
    }
  }

  let symbolName = ""
  let symbolDisplayValue = ""
  for (const prop of mainSymbol.properties) {
    if (prop.key === "Reference") symbolName = prop.value
    if (prop.key === "Value") symbolDisplayValue = prop.value
  }
  if (!symbolName) symbolName = mainSymbol.name

  return {
    schPortArrangement: arrangement,
    pinLabels,
    symbolName,
    symbolDisplayValue,
  }
}
