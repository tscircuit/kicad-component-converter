import parseSExpression from "s-expression"
import {
  kicad_sym_json_def,
  kicad_sym_lib_json_def,
  type KicadSymJson,
  type KicadSymLibJson,
  type SymArc,
  type SymCircle,
  type SymEffects,
  type SymPin,
  type SymPolyline,
  type SymProperty,
  type SymRectangle,
  type SymText,
} from "./kicad-zod"
import Debug from "debug"

const debug = Debug("kicad-sym-converter")

const getAttr = (s: Array<any>, key: string): any => {
  for (const elm of s) {
    if (Array.isArray(elm) && elm[0] === key) {
      return elm.slice(1)
    }
  }
  return undefined
}

const getAttrValue = (s: Array<any>, key: string): any => {
  const attr = getAttr(s, key)
  if (attr === undefined) return undefined
  if (attr.length === 1) return attr[0]?.valueOf?.() ?? attr[0]
  return attr.map((a: any) => a?.valueOf?.() ?? a)
}

const parseBool = (val: any): boolean => {
  if (val === undefined) return false
  const str = val?.valueOf?.() ?? val
  return str === "yes" || str === true
}

const parseNumber = (val: any): number => {
  if (typeof val === "number") return val
  const str = val?.valueOf?.() ?? val
  return Number.parseFloat(str)
}

const parsePoint2 = (arr: any[]): [number, number] => {
  return [parseNumber(arr[0]), parseNumber(arr[1])]
}

const parseStroke = (strokeArr: any[]): { width: number; type?: string } => {
  const strokeObj: any = {}
  for (const elm of strokeArr) {
    if (Array.isArray(elm)) {
      const key = elm[0]?.valueOf?.() ?? elm[0]
      if (key === "width") {
        strokeObj.width = parseNumber(elm[1])
      } else if (key === "type") {
        strokeObj.type = elm[1]?.valueOf?.() ?? elm[1]
      }
    }
  }
  return strokeObj
}

const parseFill = (fillArr: any[]): { type: string } => {
  const fillObj: any = { type: "none" }
  for (const elm of fillArr) {
    if (Array.isArray(elm)) {
      const key = elm[0]?.valueOf?.() ?? elm[0]
      if (key === "type") {
        fillObj.type = elm[1]?.valueOf?.() ?? elm[1]
      }
    }
  }
  return fillObj
}

const parseEffects = (effectsArr: any[]): SymEffects => {
  const effects: SymEffects = {}
  for (const elm of effectsArr) {
    if (!Array.isArray(elm)) continue
    const key = elm[0]?.valueOf?.() ?? elm[0]

    if (key === "font") {
      const fontObj: any = {}
      for (const fontElm of elm.slice(1)) {
        if (Array.isArray(fontElm)) {
          const fontKey = fontElm[0]?.valueOf?.() ?? fontElm[0]
          if (fontKey === "size") {
            fontObj.size = parsePoint2(fontElm.slice(1))
          } else if (fontKey === "thickness") {
            fontObj.thickness = parseNumber(fontElm[1])
          }
        }
      }
      effects.font = fontObj
    } else if (key === "justify") {
      effects.justify = elm.slice(1).map((j: any) => j?.valueOf?.() ?? j)
    } else if (key === "hide") {
      effects.hide = true
    }
  }
  return effects
}

const parseProperty = (propArr: any[]): SymProperty => {
  const key = propArr[1]?.valueOf?.() ?? propArr[1]
  const value = propArr[2]?.valueOf?.() ?? propArr[2]

  const prop: SymProperty = {
    key,
    value,
  }

  // Look for (at x y angle) and (effects ...)
  for (const elm of propArr.slice(3)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "at") {
      prop.at = [parseNumber(elm[1]), parseNumber(elm[2])]
      // angle is optional third parameter
    } else if (elmKey === "effects") {
      prop.effects = parseEffects(elm.slice(1))
    }
  }

  return prop
}

const parsePin = (pinArr: any[]): SymPin => {
  // (pin TYPE SHAPE (at X Y ANGLE) (length LEN) (name "NAME" (effects...)) (number "NUM" (effects...)))
  const pinType = pinArr[1]?.valueOf?.() ?? pinArr[1]
  const pinShape = pinArr[2]?.valueOf?.() ?? pinArr[2]

  let at: [number, number] = [0, 0]
  let angle = 0
  let length = 0
  let name = ""
  let number = ""
  let nameEffects: SymEffects | undefined
  let numberEffects: SymEffects | undefined
  let hide = false

  for (const elm of pinArr.slice(3)) {
    if (!Array.isArray(elm)) {
      // Check for "hide" token
      if (elm?.valueOf?.() === "hide" || elm === "hide") {
        hide = true
      }
      continue
    }
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "at") {
      at = parsePoint2(elm.slice(1))
      if (elm.length > 3) {
        angle = parseNumber(elm[3])
      }
    } else if (elmKey === "length") {
      length = parseNumber(elm[1])
    } else if (elmKey === "name") {
      name = elm[1]?.valueOf?.() ?? elm[1]
      // Check for effects in name
      const nameEffectsArr = getAttr(elm, "effects")
      if (nameEffectsArr) {
        nameEffects = parseEffects(nameEffectsArr)
      }
    } else if (elmKey === "number") {
      number = elm[1]?.valueOf?.() ?? elm[1]
      // Check for effects in number
      const numberEffectsArr = getAttr(elm, "effects")
      if (numberEffectsArr) {
        numberEffects = parseEffects(numberEffectsArr)
      }
    } else if (elmKey === "hide") {
      hide = true
    }
  }

  return {
    pin_type: pinType,
    pin_shape: pinShape,
    at,
    angle,
    length,
    name,
    number,
    name_effects: nameEffects,
    number_effects: numberEffects,
    hide,
  }
}

const parsePolyline = (polylineArr: any[]): SymPolyline => {
  const polyline: SymPolyline = {
    pts: [],
  }

  for (const elm of polylineArr.slice(1)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "pts") {
      for (const pt of elm.slice(1)) {
        if (Array.isArray(pt) && (pt[0]?.valueOf?.() ?? pt[0]) === "xy") {
          polyline.pts.push(parsePoint2(pt.slice(1)))
        }
      }
    } else if (elmKey === "stroke") {
      polyline.stroke = parseStroke(elm.slice(1))
    } else if (elmKey === "fill") {
      polyline.fill = parseFill(elm.slice(1))
    }
  }

  return polyline
}

const parseRectangle = (rectArr: any[]): SymRectangle => {
  const rect: SymRectangle = {
    start: [0, 0],
    end: [0, 0],
  }

  for (const elm of rectArr.slice(1)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "start") {
      rect.start = parsePoint2(elm.slice(1))
    } else if (elmKey === "end") {
      rect.end = parsePoint2(elm.slice(1))
    } else if (elmKey === "stroke") {
      rect.stroke = parseStroke(elm.slice(1))
    } else if (elmKey === "fill") {
      rect.fill = parseFill(elm.slice(1))
    }
  }

  return rect
}

const parseCircle = (circleArr: any[]): SymCircle => {
  const circle: SymCircle = {
    center: [0, 0],
    radius: 0,
  }

  for (const elm of circleArr.slice(1)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "center") {
      circle.center = parsePoint2(elm.slice(1))
    } else if (elmKey === "radius") {
      circle.radius = parseNumber(elm[1])
    } else if (elmKey === "stroke") {
      circle.stroke = parseStroke(elm.slice(1))
    } else if (elmKey === "fill") {
      circle.fill = parseFill(elm.slice(1))
    }
  }

  return circle
}

const parseArc = (arcArr: any[]): SymArc => {
  const arc: SymArc = {
    start: [0, 0],
    mid: [0, 0],
    end: [0, 0],
  }

  for (const elm of arcArr.slice(1)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "start") {
      arc.start = parsePoint2(elm.slice(1))
    } else if (elmKey === "mid") {
      arc.mid = parsePoint2(elm.slice(1))
    } else if (elmKey === "end") {
      arc.end = parsePoint2(elm.slice(1))
    } else if (elmKey === "stroke") {
      arc.stroke = parseStroke(elm.slice(1))
    } else if (elmKey === "fill") {
      arc.fill = parseFill(elm.slice(1))
    }
  }

  return arc
}

const parseText = (textArr: any[]): SymText => {
  const text: SymText = {
    text: textArr[1]?.valueOf?.() ?? textArr[1],
  }

  for (const elm of textArr.slice(2)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "at") {
      text.at = [parseNumber(elm[1]), parseNumber(elm[2])]
    } else if (elmKey === "effects") {
      text.effects = parseEffects(elm.slice(1))
    }
  }

  return text
}

const parseSymbol = (symbolArr: any[]): KicadSymJson => {
  const symbolName = symbolArr[1]?.valueOf?.() ?? symbolArr[1]

  const properties: SymProperty[] = []
  const pins: SymPin[] = []
  const polylines: SymPolyline[] = []
  const rectangles: SymRectangle[] = []
  const circles: SymCircle[] = []
  const arcs: SymArc[] = []
  const texts: SymText[] = []

  let exclude_from_sim = false
  let in_bom = true
  let on_board = true

  // Parse all elements including nested sub-symbols
  const parseElements = (elements: any[]) => {
    for (const elm of elements) {
      if (!Array.isArray(elm)) continue
      const elmKey = elm[0]?.valueOf?.() ?? elm[0]

      if (elmKey === "property") {
        properties.push(parseProperty(elm))
      } else if (elmKey === "pin") {
        pins.push(parsePin(elm))
      } else if (elmKey === "polyline") {
        polylines.push(parsePolyline(elm))
      } else if (elmKey === "rectangle") {
        rectangles.push(parseRectangle(elm))
      } else if (elmKey === "circle") {
        circles.push(parseCircle(elm))
      } else if (elmKey === "arc") {
        arcs.push(parseArc(elm))
      } else if (elmKey === "text") {
        texts.push(parseText(elm))
      } else if (elmKey === "exclude_from_sim") {
        exclude_from_sim = parseBool(elm[1])
      } else if (elmKey === "in_bom") {
        in_bom = parseBool(elm[1])
      } else if (elmKey === "on_board") {
        on_board = parseBool(elm[1])
      } else if (elmKey === "symbol") {
        // Nested sub-symbol (e.g., "SymbolName_0_1", "SymbolName_1_1")
        // Contains graphical elements and pins
        parseElements(elm.slice(2))
      }
    }
  }

  parseElements(symbolArr.slice(2))

  return {
    symbol_name: symbolName,
    exclude_from_sim,
    in_bom,
    on_board,
    properties,
    pins,
    polylines: polylines.length > 0 ? polylines : undefined,
    rectangles: rectangles.length > 0 ? rectangles : undefined,
    circles: circles.length > 0 ? circles : undefined,
    arcs: arcs.length > 0 ? arcs : undefined,
    texts: texts.length > 0 ? texts : undefined,
  }
}

/**
 * Parse a KiCad symbol library file (.kicad_sym) to JSON
 * Returns the library containing multiple symbols
 */
export const parseKicadSymLibToKicadJson = (
  fileContent: string,
): KicadSymLibJson => {
  const kicadSExpr = parseSExpression(fileContent)

  // The root should be (kicad_symbol_lib ...)
  const rootType = kicadSExpr[0]?.valueOf?.() ?? kicadSExpr[0]
  if (rootType !== "kicad_symbol_lib") {
    throw new Error(
      `Expected kicad_symbol_lib, got ${rootType}. This may not be a valid KiCad symbol library file.`,
    )
  }

  const version = getAttrValue(kicadSExpr, "version")
  const generator = getAttrValue(kicadSExpr, "generator")
  const generator_version = getAttrValue(kicadSExpr, "generator_version")

  const symbols: KicadSymJson[] = []

  // Find all top-level symbol definitions
  for (const elm of kicadSExpr.slice(1)) {
    if (!Array.isArray(elm)) continue
    const elmKey = elm[0]?.valueOf?.() ?? elm[0]

    if (elmKey === "symbol") {
      const symbolName = elm[1]?.valueOf?.() ?? elm[1]
      // Skip sub-symbols (they contain underscores followed by unit numbers like "_0_1")
      // We only want top-level symbols
      if (!symbolName.includes("_0_") && !symbolName.includes("_1_")) {
        symbols.push(parseSymbol(elm))
      } else {
        // This might be a case where the symbol name itself contains underscores
        // Check if this is nested inside another symbol (it shouldn't be at top level)
        // Top-level symbols don't have the _N_N pattern
        const parts = symbolName.split("_")
        const lastTwo = parts.slice(-2)
        if (
          lastTwo.length === 2 &&
          /^\d+$/.test(lastTwo[0]) &&
          /^\d+$/.test(lastTwo[1])
        ) {
          // This is a sub-symbol, skip it
          continue
        }
        symbols.push(parseSymbol(elm))
      }
    }
  }

  return kicad_sym_lib_json_def.parse({
    version,
    generator,
    generator_version,
    symbols,
  })
}

/**
 * Parse a single KiCad symbol from file content
 * If the file contains multiple symbols, returns the first one
 */
export const parseKicadSymToKicadJson = (
  fileContent: string,
): KicadSymJson => {
  // Check if this is a library file or a single symbol
  const trimmed = fileContent.trim()

  if (trimmed.startsWith("(kicad_symbol_lib")) {
    const lib = parseKicadSymLibToKicadJson(fileContent)
    if (lib.symbols.length === 0) {
      throw new Error("No symbols found in library file")
    }
    return lib.symbols[0]
  }

  if (trimmed.startsWith("(symbol")) {
    // Single symbol definition
    const kicadSExpr = parseSExpression(fileContent)
    return kicad_sym_json_def.parse(parseSymbol(kicadSExpr))
  }

  throw new Error(
    "Invalid KiCad symbol file format. Expected (kicad_symbol_lib ...) or (symbol ...)",
  )
}
