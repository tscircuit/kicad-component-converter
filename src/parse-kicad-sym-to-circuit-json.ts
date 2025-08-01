import type { AnyCircuitElement } from "circuit-json"
import { parseKicadSymToKicadJson } from "./parse-kicad-sym-to-kicad-json"

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const kicadSymJson = parseKicadSymToKicadJson(kicadSym)

  // For now, just return an empty array since kicad_sym files don't directly
  // translate to circuit elements - they provide schematic information
  // that enhances the schematic_component created from kicad_mod files
  return []
}
