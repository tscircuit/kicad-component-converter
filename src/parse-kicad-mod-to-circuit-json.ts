import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"
import {
  applyKicadSymToCircuitJson,
  parseKicadSymToCircuitJson,
} from "./parse-kicad-sym-to-schematic-fields"

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  options?: { kicadSym?: string },
): Promise<AnyCircuitElement[]> => {
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson)
  if (!options?.kicadSym) return circuitJson as any

  return applyKicadSymToCircuitJson(circuitJson as any, options.kicadSym)
}

export const parseKicadComponentToCircuitJson = async (params: {
  kicadMod?: string
  kicadSym?: string
}): Promise<AnyCircuitElement[]> => {
  if (params.kicadMod) {
    return parseKicadModToCircuitJson(params.kicadMod, {
      kicadSym: params.kicadSym,
    })
  }
  if (params.kicadSym) {
    return parseKicadSymToCircuitJson(params.kicadSym)
  }
  throw new Error("No KiCad footprint or symbol file provided")
}
