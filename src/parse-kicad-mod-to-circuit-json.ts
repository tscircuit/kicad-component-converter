import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadSymToSchematicPortInfo } from "./parse-kicad-sym-to-schematic-port-info"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  kicadSym?: string,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const symPortInfo = kicadSym
    ? parseKicadSymToSchematicPortInfo(kicadSym)
    : undefined

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson, symPortInfo)
  return circuitJson as any
}
