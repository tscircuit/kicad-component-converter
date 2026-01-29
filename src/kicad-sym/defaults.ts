/**
 * Default values for KiCad symbol rendering
 * These match KiCad's default symbol appearance
 */

// Default stroke width in mm (KiCad default)
export const DEFAULT_STROKE_WIDTH = 0.254

// Default font size in mm (KiCad default)
export const DEFAULT_FONT_SIZE = 1.27

// Default color for schematic elements (brown - matches KiCad symbol color)
export const DEFAULT_SCHEMATIC_COLOR = "brown"

// Stroke type mapping from KiCad to circuit-json
export function isDashedFromStrokeType(
  strokeType: string | undefined,
): boolean {
  if (!strokeType) return false
  return ["dash", "dash_dot", "dash_dot_dot", "dot"].includes(strokeType)
}
