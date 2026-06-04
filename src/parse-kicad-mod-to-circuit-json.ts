import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup as convertKicadJsonToCircuitJson } from "./convert-kicad-json-to-tscircuit-soup"

export interface ParseKicadModToCircuitJsonOptions {
  kicadSym?: string
}

export const parseKicadModToCircuitJson = async (
  kicadMod: string,
  optionsOrKicadSym?: ParseKicadModToCircuitJsonOptions | string,
): Promise<AnyCircuitElement[]> => {
  const options =
    typeof optionsOrKicadSym === "string"
      ? { kicadSym: optionsOrKicadSym }
      : (optionsOrKicadSym ?? {})
  const kicadJson = parseKicadModToKicadJson(kicadMod)

  const circuitJson = await convertKicadJsonToCircuitJson(kicadJson, options)
  return circuitJson as any
}
