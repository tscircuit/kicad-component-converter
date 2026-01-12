// KiCad Footprint (.kicad_mod) exports
export { parseKicadModToKicadJson } from "./parse-kicad-mod-to-kicad-json"
export { parseKicadModToCircuitJson } from "./parse-kicad-mod-to-circuit-json"
export { convertKicadJsonToTsCircuitSoup } from "./convert-kicad-json-to-tscircuit-soup"

// KiCad Symbol (.kicad_sym) exports
export {
  parseKicadSymToKicadJson,
  parseKicadSymLibToKicadJson,
} from "./parse-kicad-sym-to-kicad-json"
export {
  parseKicadSymToCircuitJson,
  parseKicadSymLibToCircuitJson,
} from "./parse-kicad-sym-to-circuit-json"
export {
  convertKicadSymJsonToTsCircuitSoup,
  convertKicadSymLibJsonToTsCircuitSoup,
} from "./convert-kicad-sym-json-to-tscircuit-soup"

// Types
export type {
  KicadModJson,
  KicadSymJson,
  KicadSymLibJson,
  SymPin,
  SymProperty,
  SymPolyline,
  SymRectangle,
  SymCircle,
  SymArc,
  SymText,
} from "./kicad-zod"
