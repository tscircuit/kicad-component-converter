import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import {
  getPortLabelsFromKicadPins,
  getSchPortArrangementFromKicadPins,
  parseKicadSymToSymbolMetadata,
} from "./parse-kicad-sym-to-symbol-metadata"

export interface ParseKicadModToCircuitJsonOptions {
  kicadSym?: string
}

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options: ParseKicadModToCircuitJsonOptions = {},
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)

  if (options.kicadSym) {
    const symbolMetadata = parseKicadSymToSymbolMetadata(options.kicadSym)
    const schematicComponent = circuitJson.find(
      (elm) => elm.type === "schematic_component",
    ) as any

    if (schematicComponent) {
      schematicComponent.symbol_name = symbolMetadata.symbolName
      schematicComponent.port_arrangement = getSchPortArrangementFromKicadPins(
        symbolMetadata.pins,
      )
      schematicComponent.port_labels = getPortLabelsFromKicadPins(
        symbolMetadata.pins,
      )
      schematicComponent.is_box_with_pins = true
    }
  }

  return circuitJson as any
}
