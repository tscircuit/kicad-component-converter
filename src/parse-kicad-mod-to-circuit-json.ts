import type { AnyCircuitElement } from "circuit-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import {
  type KicadSymSchematicMetadata,
  parseKicadSymToSchematicMetadata,
} from "./parse-kicad-sym-to-schematic-metadata"

const applySchematicMetadata = (
  circuitJson: AnyCircuitElement[],
  schematicMetadata?: KicadSymSchematicMetadata,
) => {
  if (!schematicMetadata) return circuitJson

  const schematicComponent = circuitJson.find(
    (elm: any) => elm.type === "schematic_component",
  ) as any
  if (schematicComponent) {
    schematicComponent.port_arrangement = schematicMetadata.port_arrangement
    schematicComponent.port_labels = schematicMetadata.port_labels
  }

  for (const elm of circuitJson as any[]) {
    if (elm.type !== "source_port") continue
    const portName = `${elm.name}`
    const label =
      schematicMetadata.port_labels?.[portName] ??
      (elm.pin_number !== undefined
        ? schematicMetadata.port_labels?.[`${elm.pin_number}`]
        : undefined)
    if (!label) continue
    elm.pin_label = label
    elm.port_hints =
      label !== portName ? [portName, label] : (elm.port_hints ?? [portName])
  }

  return circuitJson
}

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options: { kicadSym?: string } = {},
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)
  const schematicMetadata = options.kicadSym
    ? parseKicadSymToSchematicMetadata(options.kicadSym)
    : undefined

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  return applySchematicMetadata(circuitJson as any, schematicMetadata) as any
}
