import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import {
  parseKicadSymToSchematicInfo,
  type SchematicInfo,
} from "./parse-kicad-sym-to-schematic-info"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  kicadSym?: string,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)

  // If kicad_sym content is provided, enrich the schematic_component
  if (kicadSym) {
    const schInfo = parseKicadSymToSchematicInfo(kicadSym)
    enrichWithSchematicInfo(circuitJson as any[], schInfo)
  }

  return circuitJson as any
}

/**
 * Enrich circuit JSON with schematic info from kicad_sym.
 * Finds the schematic_component element and adds pinLabels + schPinArrangement.
 */
function enrichWithSchematicInfo(
  elements: any[],
  schInfo: SchematicInfo,
): void {
  const schComponent = elements.find(
    (e: any) => e.type === "schematic_component",
  )
  if (schComponent) {
    schComponent.pin_labels = schInfo.pinLabels
    schComponent.port_arrangement = schInfo.schPinArrangement
  }

  // Also enrich source_component if present
  const srcComponent = elements.find((e: any) => e.type === "source_component")
  if (srcComponent) {
    srcComponent.pin_labels = schInfo.pinLabels
    srcComponent.port_arrangement = schInfo.schPinArrangement
  }

  // Update source_port pin labels based on pinLabels mapping
  for (const element of elements) {
    if (element.type === "source_port" && element.pin_number != null) {
      const label = schInfo.pinLabels[`pin${element.pin_number}`]
      if (label) {
        element.pin_label = label
        if (!element.port_hints?.includes(label)) {
          element.port_hints = [...(element.port_hints || []), label]
        }
      }
    }
  }
}
