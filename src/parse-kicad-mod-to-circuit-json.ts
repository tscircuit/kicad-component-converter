import type { AnyCircuitElement } from "circuit-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { applyKicadSymToCircuitJson } from "./parse-kicad-sym-to-kicad-json"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  kicadSym?: string,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  let circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  if (kicadSym) {
    circuitJson = applyKicadSymToCircuitJson(circuitJson, kicadSym)
  }
  return circuitJson as any
}
