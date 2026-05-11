import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { enhanceCircuitJsonWithKicadSym } from "./parse-kicad-sym-to-circuit-json"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options: { kicadSym?: string } = {},
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  if (options.kicadSym) {
    return enhanceCircuitJsonWithKicadSym(circuitJson as any, options.kicadSym)
  }
  return circuitJson as any
}
