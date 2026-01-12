import type { AnyCircuitElement } from "circuit-json"
import {
  parseKicadSymToKicadJson,
  parseKicadSymLibToKicadJson,
} from "./parse-kicad-sym-to-kicad-json"
import {
  convertKicadSymJsonToTsCircuitSoup,
  convertKicadSymLibJsonToTsCircuitSoup,
} from "./convert-kicad-sym-json-to-tscircuit-soup"

/**
 * Parse a KiCad symbol file and convert it to Circuit JSON
 * If the file contains multiple symbols, returns the first one
 */
export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const kicadSymJson = parseKicadSymToKicadJson(kicadSym)
  const circuitJson = await convertKicadSymJsonToTsCircuitSoup(kicadSymJson)
  return circuitJson
}

/**
 * Parse a KiCad symbol library file and convert all symbols to Circuit JSON
 */
export const parseKicadSymLibToCircuitJson = async (
  kicadSymLib: string,
): Promise<AnyCircuitElement[]> => {
  const kicadSymLibJson = parseKicadSymLibToKicadJson(kicadSymLib)
  const circuitJson =
    await convertKicadSymLibJsonToTsCircuitSoup(kicadSymLibJson)
  return circuitJson
}
