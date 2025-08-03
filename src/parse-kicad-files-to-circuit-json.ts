import type { AnyCircuitElement } from "circuit-json"
import { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
import { parseKicadSymToKicadJson } from "./parse-kicad-sym-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup } from "./convert-kicad-json-to-tscircuit-soup"

export interface KicadFiles {
  kicad_mod?: string
  kicad_sym?: string
}

/**
 * Parse both kicad_mod and kicad_sym files and convert them to circuit JSON
 * The kicad_mod provides the PCB footprint information
 * The kicad_sym provides the schematic symbol information (port arrangement, pin labels)
 */
export const parseKicadFilesToCircuitJson = async (
  files: KicadFiles,
): Promise<AnyCircuitElement[]> => {
  if (!files.kicad_mod) {
    throw new Error("kicad_mod file is required")
  }

  // Parse the kicad_mod file
  const kicadModJson = parseKicadModToKicadJson(files.kicad_mod)

  // Parse the kicad_sym file if provided
  let kicadSymJson = undefined
  if (files.kicad_sym) {
    try {
      kicadSymJson = parseKicadSymToKicadJson(files.kicad_sym)
    } catch (error) {
      console.warn("Failed to parse kicad_sym file:", error)
      // Continue without symbol information
    }
  }

  // Convert to circuit JSON with enhanced schematic information
  const circuitJson = await convertKicadJsonToTsCircuitSoup(
    kicadModJson,
    kicadSymJson,
  )
  return circuitJson as any
}
