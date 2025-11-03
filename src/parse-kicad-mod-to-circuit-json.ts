import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import {
  convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson,
  type ResolvedPcbStyle,
} from "./convert-kicad-json-to-tscircuit-soup"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options?: { resolvedPcbStyle?: ResolvedPcbStyle },
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson, options)
  return circuitJson as any
}
