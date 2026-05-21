import parseSExpression from "s-expression"
import type {
  KicadSymJson,
  KicadSymSymbol,
  SymbolPin,
  SymbolProperty,
} from "./kicad-zod"
import { getAttr } from "./get-attr"

const parsePin = (pinExpr: any[]): SymbolPin => {
  const pin_type = pinExpr[1]?.valueOf?.() ?? ""
  const pin_shape = pinExpr[2]?.valueOf?.() ?? ""
  const at = getAttr(pinExpr, "at") ?? [0, 0, 0]
  const length = getAttr(pinExpr, "length") ?? 0

  let name = ""
  let number = ""
  for (const child of pinExpr) {
    if (Array.isArray(child) && child[0] === "name") {
      name = child[1]?.valueOf?.() ?? ""
    }
    if (Array.isArray(child) && child[0] === "number") {
      number = child[1]?.valueOf?.() ?? ""
    }
  }

  return {
    pin_type,
    pin_shape,
    at: Array.isArray(at) ? at.map(Number) : [0, 0, 0],
    length: typeof length === "number" ? length : Number(length),
    name,
    number,
  }
}

const parseSymbol = (symbolExpr: any[]): KicadSymSymbol => {
  const name = symbolExpr[1]?.valueOf?.() ?? ""
  const properties: SymbolProperty[] = []
  const pins: SymbolPin[] = []
  const units: KicadSymSymbol[] = []

  for (const child of symbolExpr.slice(2)) {
    if (!Array.isArray(child)) continue
    const tag = child[0]?.valueOf?.()
    if (tag === "property") {
      properties.push({
        key: child[1]?.valueOf?.() ?? "",
        value: child[2]?.valueOf?.() ?? "",
      })
    } else if (tag === "pin") {
      pins.push(parsePin(child))
    } else if (tag === "symbol") {
      units.push(parseSymbol(child))
    }
  }

  return { name, properties, pins, units }
}

export const parseKicadSymToKicadJson = (fileContent: string): KicadSymJson => {
  const sexpr = parseSExpression(fileContent)

  let version: string | undefined
  let generator: string | undefined
  const symbols: KicadSymSymbol[] = []

  for (const child of sexpr.slice(1)) {
    if (!Array.isArray(child)) continue
    const tag = child[0]?.valueOf?.()
    if (tag === "version") {
      version = child[1]?.valueOf?.()
    } else if (tag === "generator") {
      generator = child[1]?.valueOf?.()
    } else if (tag === "symbol") {
      symbols.push(parseSymbol(child))
    }
  }

  return { version, generator, symbols }
}
