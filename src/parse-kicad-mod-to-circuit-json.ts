import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import {
  applyKicadSymMetadataToCircuitJson,
  parseKicadSymToMetadata,
} from "./parse-kicad-sym-to-circuit-json"

interface ParseKicadModToCircuitJsonOptions {
  kicadSym?: string
}

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options: ParseKicadModToCircuitJsonOptions = {},
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  let circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  if (options.kicadSym) {
    circuitJson = applyKicadSymMetadataToCircuitJson(
      circuitJson,
      parseKicadSymToMetadata(options.kicadSym),
    )
  }
  return circuitJson as any
}
