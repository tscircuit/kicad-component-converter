import parseSExpression from "s-expression"
import {
  kicad_sym_json_def,
  symbol_def,
  symbol_pin_def,
  symbol_property_def,
  effects_def,
  stroke_def,
  fill_def,
  type KicadSymJson,
  type Symbol,
  type SymbolPin,
  type SymbolProperty,
} from "./kicad-zod"
import { formatAttr, getAttr } from "./get-attr"
import Debug from "debug"

const debug = Debug("kicad-sym-converter")

export const parseKicadSymToKicadJson = (fileContent: string): KicadSymJson => {
  const kicadSExpr = parseSExpression(fileContent)

  // The root should be (kicad_symbol_lib ...)
  if (kicadSExpr[0] !== "kicad_symbol_lib") {
    throw new Error("Invalid kicad_sym file: missing kicad_symbol_lib root")
  }

  let version = ""
  let generator = ""
  const symbols: Symbol[] = []

  // Parse header information and symbols
  for (const row of kicadSExpr.slice(1)) {
    if (Array.isArray(row)) {
      const token = row[0]?.valueOf()
      
      if (token === "version") {
        version = row[1]?.valueOf() || ""
      } else if (token === "generator") {
        generator = row[1]?.valueOf() || ""
      } else if (token === "symbol") {
        const symbol = parseSymbol(row)
        if (symbol) {
          symbols.push(symbol)
        }
      }
    }
  }

  return kicad_sym_json_def.parse({
    version,
    generator,
    symbols,
  })
}

const parseSymbol = (symbolRow: any[]): Symbol | null => {
  try {
    const name = symbolRow[1]?.valueOf() || ""

    let extends: string | undefined
    let pin_numbers_hide = false
    let pin_names_hide = false
    let pin_names_offset: number | undefined
    let in_bom = true
    let on_board = true
    const properties: SymbolProperty[] = []
    const pins: SymbolPin[] = []
    const units: Symbol[] = []
    let unit_name: string | undefined

    // Parse symbol attributes
    for (const attr of symbolRow.slice(2)) {
      if (!Array.isArray(attr)) continue

      const token = attr[0]?.valueOf()

      switch (token) {
        case "extends":
          extends = attr[1]?.valueOf()
          break
        case "pin_numbers":
          if (attr[1]?.valueOf() === "hide") {
            pin_numbers_hide = true
          }
          break
        case "pin_names":
          // Can have (pin_names hide) or (pin_names (offset 0.508) hide)
          for (const subAttr of attr.slice(1)) {
            if (subAttr === "hide") {
              pin_names_hide = true
            } else if (Array.isArray(subAttr) && subAttr[0] === "offset") {
              pin_names_offset = Number.parseFloat(subAttr[1]?.valueOf() || "0")
            }
          }
          break
        case "in_bom":
          in_bom = attr[1]?.valueOf() === "yes"
          break
        case "on_board":
          on_board = attr[1]?.valueOf() === "yes"
          break
        case "property":
          const property = parseProperty(attr)
          if (property) {
            properties.push(property)
          }
          break
        case "pin":
          const pin = parsePin(attr)
          if (pin) {
            pins.push(pin)
          }
          break
        case "symbol":
          const unit = parseSymbol(attr)
          if (unit) {
            units.push(unit)
          }
          break
        case "unit_name":
          unit_name = attr[1]?.valueOf()
          break
        // Skip graphic items for now - we'll focus on pins for schematic view
        case "arc":
        case "circle":
        case "rectangle":
        case "polyline":
        case "text":
          // TODO: Parse graphic items if needed for symbol display
          break
      }
    }

    return symbol_def.parse({
      name,
      extends,
      pin_numbers_hide: pin_numbers_hide || undefined,
      pin_names_hide: pin_names_hide || undefined,
      pin_names_offset,
      in_bom,
      on_board,
      properties,
      pins,
      units: units.length > 0 ? units : undefined,
      unit_name,
    })
  } catch (error) {
    debug(`Error parsing symbol: ${error}`)
    return null
  }
}

const parseProperty = (propertyRow: any[]): SymbolProperty | null => {
  try {
    const key = propertyRow[1]?.valueOf() || ""
    const value = propertyRow[2]?.valueOf() || ""
    
    let id = 0
    let at = [0, 0] as [number, number]
    let effects = undefined

    for (const attr of propertyRow.slice(3)) {
      if (!Array.isArray(attr)) continue
      
      const token = attr[0]?.valueOf()
      
      switch (token) {
        case "id":
          id = Number.parseInt(attr[1]?.valueOf() || "0")
          break
        case "at":
          at = [
            Number.parseFloat(attr[1]?.valueOf() || "0"),
            Number.parseFloat(attr[2]?.valueOf() || "0")
          ]
          break
        case "effects":
          effects = parseEffects(attr)
          break
      }
    }

    return symbol_property_def.parse({
      key,
      value,
      id,
      at,
      effects,
    })
  } catch (error) {
    debug(`Error parsing property: ${error}`)
    return null
  }
}

const parsePin = (pinRow: any[]): SymbolPin | null => {
  try {
    const electrical_type = pinRow[1]?.valueOf() || "passive"
    const graphic_style = pinRow[2]?.valueOf() || "line"
    
    let at = [0, 0] as [number, number]
    let length = 2.54
    let name = ""
    let number = ""
    let name_effects = undefined
    let number_effects = undefined

    for (const attr of pinRow.slice(3)) {
      if (!Array.isArray(attr)) continue
      
      const token = attr[0]?.valueOf()
      
      switch (token) {
        case "at":
          at = [
            Number.parseFloat(attr[1]?.valueOf() || "0"),
            Number.parseFloat(attr[2]?.valueOf() || "0")
          ]
          if (attr[3]) {
            at.push(Number.parseFloat(attr[3]?.valueOf() || "0"))
          }
          break
        case "length":
          length = Number.parseFloat(attr[1]?.valueOf() || "2.54")
          break
        case "name":
          name = attr[1]?.valueOf() || ""
          if (attr[2]) {
            name_effects = parseEffects(attr[2])
          }
          break
        case "number":
          number = attr[1]?.valueOf() || ""
          if (attr[2]) {
            number_effects = parseEffects(attr[2])
          }
          break
      }
    }

    return symbol_pin_def.parse({
      electrical_type,
      graphic_style,
      at,
      length,
      name,
      number,
      name_effects,
      number_effects,
    })
  } catch (error) {
    debug(`Error parsing pin: ${error}`)
    return null
  }
}

const parseEffects = (effectsRow: any[]): any => {
  try {
    const effectsObj: any = {}
    
    for (const attr of effectsRow.slice(1)) {
      if (!Array.isArray(attr)) continue
      
      const token = attr[0]?.valueOf()
      
      if (token === "font") {
        const fontObj: any = {}
        for (const fontAttr of attr.slice(1)) {
          if (Array.isArray(fontAttr)) {
            const fontToken = fontAttr[0]?.valueOf()
            if (fontToken === "size") {
              fontObj.size = [
                Number.parseFloat(fontAttr[1]?.valueOf() || "1.27"),
                Number.parseFloat(fontAttr[2]?.valueOf() || "1.27")
              ]
            } else if (fontToken === "thickness") {
              fontObj.thickness = Number.parseFloat(fontAttr[1]?.valueOf() || "0")
            }
          } else if (fontAttr === "bold") {
            fontObj.bold = true
          } else if (fontAttr === "italic") {
            fontObj.italic = true
          }
        }
        effectsObj.font = fontObj
      } else if (token === "hide") {
        effectsObj.hide = true
      }
    }

    return effects_def.parse(effectsObj)
  } catch (error) {
    debug(`Error parsing effects: ${error}`)
    return undefined
  }
}
