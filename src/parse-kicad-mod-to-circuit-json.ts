import type { AnyCircuitElement } from "circuit-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { parseKicadSymToSchematicMetadata } from "./parse-kicad-sym-to-schematic-metadata"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options?: { kicadSym?: string },
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)
  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)

  if (options?.kicadSym) {
    const meta = parseKicadSymToSchematicMetadata(options.kicadSym)
    const sourceComponent = circuitJson.find(
      (el) => el.type === "source_component",
    )
    if (sourceComponent) {
      Object.assign(sourceComponent, meta)
    }
  }

  return circuitJson as any
}
