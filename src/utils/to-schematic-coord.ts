/**
 * Convert KiCad coordinates to schematic coordinates
 * KiCad symbols and tscircuit both use Y+ = up, so no flip needed
 */
export function toSchematicCoord(
  x: number,
  y: number,
): { schX: number; schY: number } {
  return { schX: x, schY: y }
}
