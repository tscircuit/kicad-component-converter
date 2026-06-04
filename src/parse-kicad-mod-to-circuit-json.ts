import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadSymToSchematicMetadata } from "./parse-kicad-sym-to-schematic-metadata"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options?: {
    kicadSym?: string
  },
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  if (options?.kicadSym) {
    const schematicMetadata = parseKicadSymToSchematicMetadata(options.kicadSym)
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component",
    )
    if (sourceComponent) {
      Object.assign(sourceComponent, schematicMetadata)
    }
  }
  return circuitJson as any
}
