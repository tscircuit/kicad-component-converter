import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { parseKicadSymToKicadJson } from "./parse-kicad-sym-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  kicadSym?: string | null,
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  let symJson = null
  if (kicadSym) {
    symJson = parseKicadSymToKicadJson(kicadSym)
  }

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson, symJson)
  return circuitJson as any
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const symJson = parseKicadSymToKicadJson(kicadSym)
  const circuitJson = await convertKicadJsonToCircuitJson(
    {
      footprint_name: "symbol_only",
      layer: "F.Cu",
      properties: [],
      fp_lines: [],
      fp_texts: [],
      fp_arcs: [],
      pads: [],
    } as any,
    symJson,
  )
  return circuitJson as any
}
