import type { AnyCircuitElement } from "circuit-json"
import type { KicadSymSchematicProps } from "./parse-kicad-sym-to-schematic-props"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  schematicProps?: Partial<KicadSymSchematicProps>,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(
    kicadJson,
    schematicProps,
  )
  return circuitJson as any
}
