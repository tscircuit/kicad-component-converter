import parseSExpression from "s-expression"
import { kicad_sym_json_def, property_def, pin_def } from "./kicad-zod"
import type { KicadSymJson, Property, Pin } from "./kicad-zod"
import { formatAttr, getAttr } from "./get-attr"
import Debug from "debug"

const debug = Debug("kicad-sym-converter")

export const parseKicadSymToKicadJson = (fileContent: string): KicadSymJson => {
  const kicadSExpr = parseSExpression(fileContent)

  if (kicadSExpr[0].valueOf() !== "kicad_symbol_lib") {
    throw new Error("Not a kicad_symbol_lib file")
  }

  const symbol = kicadSExpr.find(
    (item: any) => Array.isArray(item) && item[0] === "symbol",
  )
  if (!symbol) {
    throw new Error("No symbol found in kicad_sym file")
  }

  const symbolName = symbol[1].valueOf()

  const properties = symbol
    .slice(2)
    .filter((row: any[]) => Array.isArray(row) && row[0] === "property")
    .map((row: any) => {
      const key = row[1].valueOf()
      const val = row[2].valueOf()
      const attributes = row.slice(3).reduce((acc: any, attrAr: any[]) => {
        const attrKey = attrAr[0].valueOf()
        acc[attrKey] = formatAttr(attrAr.slice(1), attrKey)
        return acc
      }, {} as any)

      return {
        key,
        val,
        attributes,
      } as Property
    })

  const symbolGraphics = symbol.find(
    (item: any) => Array.isArray(item) && item[0] === "symbol",
  )

  const pins: Array<Pin> = []
  if (symbolGraphics) {
    const pinRows = symbolGraphics
      .slice(1)
      .filter((row: any[]) => Array.isArray(row) && row[0] === "pin")

    for (const row of pinRows) {
      const at = getAttr(row, "at")
      const length = getAttr(row, "length")
      const num = getAttr(row, "num")
      const name = getAttr(row, "name")
      const type = getAttr(row, "type")
      const shape = getAttr(row, "shape")

      if (
        num === undefined ||
        name === undefined ||
        type === undefined ||
        at === undefined ||
        length === undefined
      ) {
        debug(`Skipping invalid pin: ${JSON.stringify(row)}`)
        continue
      }

      const pinRaw = {
        num: String(num),
        name: String(name),
        type: String(type),
        shape: shape ? String(shape) : undefined,
        at,
        length,
      }
      pins.push(pin_def.parse(pinRaw))
    }
  }

  return kicad_sym_json_def.parse({
    symbol_name: symbolName,
    properties,
    pins,
  })
}
