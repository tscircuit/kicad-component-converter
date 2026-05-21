import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { parseKicadSymToKicadJson } from "./parse-kicad-sym-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup } from "./convert-kicad-json-to-tscircuit-soup"
import { convertKicadSymToSchematicInfo } from "./convert-kicad-sym-to-schematic-info"

export const parseKicadFilesToCircuitJson = async (files: {
  kicad_mod?: string
  kicad_sym?: string
}): Promise<AnyCircuitElement[]> => {
  const kicadModJson = files.kicad_mod
    ? parseKicadModToKicadJson(files.kicad_mod)
    : undefined

  const kicadSymJson = files.kicad_sym
    ? parseKicadSymToKicadJson(files.kicad_sym)
    : undefined

  const schematicInfo = kicadSymJson
    ? convertKicadSymToSchematicInfo(kicadSymJson)
    : undefined

  const circuitJson = await convertKicadJsonToTsCircuitSoup(
    kicadModJson,
    schematicInfo,
  )

  return circuitJson as AnyCircuitElement[]
}
