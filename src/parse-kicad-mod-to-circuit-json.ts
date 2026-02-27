import type { AnyCircuitElement } from "circuit-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  return circuitJson as any
}
