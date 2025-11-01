import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { parseKicadSymToKicadJson } from "./parse-kicad-sym-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  kicadSym?: string,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)
  const kicadSymJson = kicadSym ? parseKicadSymToKicadJson(kicadSym) : undefined

  const circuitJson = await convertKicadJsonToCircuitJson(
    kicadJson,
    kicadSymJson,
  )
  return circuitJson as any
}
