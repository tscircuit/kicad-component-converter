import parseSExpression from "s-expression"
import {
  type KicadSymJson,
  type Property,
  type SymPin,
  type SymSymbol,
  attributes_def,
  kicad_sym_json_def,
} from "./kicad-zod"
import { formatAttr, getAttr } from "./get-attr"

export const parseKicadSymToKicadJson = (fileContent: string): KicadSymJson => {
  const kicadSExpr = parseSExpression(fileContent)

  const libTop = kicadSExpr.slice(1)

  const topLevelAttributes: any = {}
  const symbols: SymSymbol[] = []

  for (const row of libTop) {
    if (!Array.isArray(row)) continue
    const head = row[0]?.valueOf?.()

    if (
      head === "version" ||
      head === "generator" ||
      head === "generator_version"
    ) {
      topLevelAttributes[head] = row[1]?.valueOf?.()
      continue
    }

    if (head === "symbol") {
      const symbolName = row[1]?.valueOf?.()
      const symbolBody = row.slice(2)

      const properties: Property[] = []
      const pins: SymPin[] = []

      for (const symElement of symbolBody) {
        if (!Array.isArray(symElement)) continue
        const elHead = symElement[0]?.valueOf?.()

        if (elHead === "property") {
          const key = symElement[1]?.valueOf?.()
          const val = symElement[2]?.valueOf?.()
          const attributes = attributes_def.parse(
            symElement.slice(3).reduce((acc: any, attrAr: any[]) => {
              const attrKey = attrAr[0]?.valueOf?.()
              if (attrKey) {
                acc[attrKey] = formatAttr(attrAr.slice(1), attrKey)
              }
              return acc
            }, {} as any),
          )
          properties.push({ key, val, attributes } as Property)
          continue
        }

        if (elHead === "pin") {
          const electricalType = symElement[1]?.valueOf?.()
          const at = getAttr(symElement, "at")
          const lengthVal = getAttr(symElement, "length")

          let pinName = ""
          let pinNumber = ""

          for (const pinElem of symElement.slice(2)) {
            if (!Array.isArray(pinElem)) continue
            if (pinElem[0]?.valueOf?.() === "name") {
              pinName = pinElem[1]?.valueOf?.() ?? ""
            }
            if (pinElem[0]?.valueOf?.() === "number") {
              pinNumber = pinElem[1]?.valueOf?.() ?? ""
            }
          }

          const atArr: [number, number, number] = Array.isArray(at)
            ? [Number(at[0] ?? 0), Number(at[1] ?? 0), Number(at[2] ?? 0)]
            : [0, 0, 0]

          pins.push({
            name: pinName,
            number: pinNumber,
            at: atArr,
            electrical_type: electricalType,
            length: typeof lengthVal === "number" ? lengthVal : undefined,
            rotation: atArr[2],
          })
          continue
        }

        if (elHead === "symbol") {
          const subSymbolName = symElement[1]?.valueOf?.()
          const subSymbolBody = symElement.slice(2)

          for (const subElement of subSymbolBody) {
            if (!Array.isArray(subElement)) continue
            const subHead = subElement[0]?.valueOf?.()

            if (subHead === "pin") {
              const at = getAttr(subElement, "at")
              const lengthVal = getAttr(subElement, "length")

              let pinName = ""
              let pinNumber = ""

              for (const pinElem of subElement.slice(1)) {
                if (!Array.isArray(pinElem)) continue
                if (pinElem[0]?.valueOf?.() === "name") {
                  pinName = pinElem[1]?.valueOf?.() ?? ""
                }
                if (pinElem[0]?.valueOf?.() === "number") {
                  pinNumber = pinElem[1]?.valueOf?.() ?? ""
                }
              }

              const atArr: [number, number, number] = Array.isArray(at)
                ? [Number(at[0] ?? 0), Number(at[1] ?? 0), Number(at[2] ?? 0)]
                : [0, 0, 0]

              pins.push({
                name: pinName,
                number: pinNumber,
                at: atArr,
                length: typeof lengthVal === "number" ? lengthVal : undefined,
                rotation: atArr[2],
              })
            }
          }
          continue
        }
      }

      symbols.push({
        symbol_name: symbolName ?? "unnamed",
        pins,
        properties: properties.length > 0 ? properties : undefined,
      })
    }
  }

  return kicad_sym_json_def.parse({
    symbols,
    ...topLevelAttributes,
  })
}
