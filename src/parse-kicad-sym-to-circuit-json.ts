import { parseKicadSexpr, KicadSymbolLib } from "kicadts"
import { extractSymbolData } from "./kicad-sym/extract-symbol-data"
import { convertSymbolDataToCircuitJson } from "./kicad-sym/convert-to-circuit-json"
import type { ParsedKicadSymbol } from "./kicad-sym/types"

export type { ParsedKicadSymbol, ParsedSymbolData } from "./kicad-sym/types"

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<ParsedKicadSymbol[]> => {
  const parsed = parseKicadSexpr(kicadSym)
  const symbolLib = parsed.find(
    (item) => item instanceof KicadSymbolLib,
  ) as KicadSymbolLib

  if (!symbolLib) {
    throw new Error("No KicadSymbolLib found in the file")
  }

  const results: ParsedKicadSymbol[] = []

  for (const symbol of symbolLib.symbols) {
    const symbolData = extractSymbolData(symbol)
    const circuitJson = convertSymbolDataToCircuitJson(symbolData)
    results.push({ symbolData, circuitJson })
  }

  return results
}
