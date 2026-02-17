import type { AnyCircuitElement } from "circuit-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import {
  type SchematicInfo,
  parseKicadSymToSchematicInfo,
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
 * Updates schematic_component with port_arrangement and port_labels,
 * and updates source_port elements with pin labels.
 */
function enrichWithSchematicInfo(
  elements: any[],
  schInfo: SchematicInfo,
): void {
  const schComponent = elements.find(
    (e: any) => e.type === "schematic_component",
  )
  if (schComponent) {
    schComponent.port_arrangement = schInfo.schPinArrangement
    schComponent.port_labels = schInfo.pinLabels
  }

  // Also enrich source_component if present
  const srcComponent = elements.find((e: any) => e.type === "source_component")
  if (srcComponent) {
    srcComponent.port_arrangement = schInfo.schPinArrangement
    srcComponent.port_labels = schInfo.pinLabels
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
