/**
 * Parse a .kicad_sym file and extract schematic metadata:
 * - pinLabels: mapping of pin keys to human-readable names
 * - schPortArrangement: which pins go on which side of the schematic symbol
 */

export interface KicadSymPin {
  name: string
  number: string
  x: number
  y: number
  rotation: number
  type: string
}

export interface SchPortArrangement {
  leftSide: { pins: number[] }
  rightSide: { pins: number[] }
  topSide: { pins: number[] }
  bottomSide: { pins: number[] }
}

export interface SchematicMetadata {
  pinLabels: Record<string, string>
  schPortArrangement: SchPortArrangement
  pins: KicadSymPin[]
}

/**
 * Parse pin definitions from a kicad_sym S-expression string.
 * Uses a block-based approach to handle nested parentheses.
 */
export function parseKicadSymPins(kicadSym: string): KicadSymPin[] {
  const pins: KicadSymPin[] = []

  // Find each pin block by tracking parenthesis depth
  let i = 0
  while (i < kicadSym.length) {
    const pinStart = kicadSym.indexOf("(pin ", i)
    if (pinStart === -1) break

    // Extract the full pin block by counting parens
    let depth = 0
    let blockEnd = pinStart
    for (let j = pinStart; j < kicadSym.length; j++) {
      if (kicadSym[j] === "(") depth++
      else if (kicadSym[j] === ")") {
        depth--
        if (depth === 0) {
          blockEnd = j + 1
          break
        }
      }
    }

    const block = kicadSym.slice(pinStart, blockEnd)

    // Extract pin type (first word after "pin ")
    const typeMatch = block.match(/^\(pin\s+(\w+)/)
    const type = typeMatch ? typeMatch[1] : "unknown"

    // Extract position: (at X Y [ROT])
    const atMatch = block.match(/\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\)/)
    const x = atMatch ? Number.parseFloat(atMatch[1]) : 0
    const y = atMatch ? Number.parseFloat(atMatch[2]) : 0
    const rotation = atMatch && atMatch[3] ? Number.parseFloat(atMatch[3]) : 0

    // Extract name: (name "..." ...)
    const nameMatch = block.match(/\(name\s+"([^"]*)"/)
    const name = nameMatch ? nameMatch[1] : ""

    // Extract number: (number "..." ...)
    const numberMatch = block.match(/\(number\s+"([^"]*)"/)
    const number = numberMatch ? numberMatch[1] : ""

    if (numberMatch) {
      pins.push({ type, x, y, rotation, name, number })
    }

    i = blockEnd
  }

  return pins
}

/**
 * Determine which side of the component a pin belongs to based on its rotation.
 *
 * In KiCad symbol files:
 * - 0° rotation means pin points RIGHT → pin is on the LEFT side of the component
 * - 180° rotation means pin points LEFT → pin is on the RIGHT side
 * - 90° rotation means pin points UP → pin is on the BOTTOM side
 * - 270° rotation means pin points DOWN → pin is on the TOP side
 */
function getPinSide(rotation: number): "left" | "right" | "top" | "bottom" {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 0) return "left"
  if (normalized === 180) return "right"
  if (normalized === 90) return "bottom"
  if (normalized === 270) return "top"
  // Default: use position-based heuristic for non-standard angles
  return "left"
}

/**
 * Parse a kicad_sym string and produce schematic metadata including
 * pinLabels and schPortArrangement.
 */
export function parseKicadSymToSchematicMetadata(
  kicadSym: string,
): SchematicMetadata {
  const pins = parseKicadSymPins(kicadSym)

  // Build pinLabels: { pin1: "VCC", pin2: "GND", ... }
  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    const label = pin.name === "~" ? `pin${pin.number}` : pin.name
    pinLabels[`pin${pin.number}`] = label
  }

  // Build schPortArrangement by grouping pins by side
  const arrangement: SchPortArrangement = {
    leftSide: { pins: [] },
    rightSide: { pins: [] },
    topSide: { pins: [] },
    bottomSide: { pins: [] },
  }

  for (const pin of pins) {
    const side = getPinSide(pin.rotation)
    const pinNum = Number.parseInt(pin.number, 10)
    const pinRef = Number.isNaN(pinNum) ? pin.number : pinNum

    switch (side) {
      case "left":
        arrangement.leftSide.pins.push(pinRef as number)
        break
      case "right":
        arrangement.rightSide.pins.push(pinRef as number)
        break
      case "top":
        arrangement.topSide.pins.push(pinRef as number)
        break
      case "bottom":
        arrangement.bottomSide.pins.push(pinRef as number)
        break
    }
  }

  // Sort pins on each side by position (top-to-bottom for left/right, left-to-right for top/bottom)
  const sortByY = (a: number, b: number) => {
    const pinA = pins.find((p) => Number.parseInt(p.number, 10) === a)
    const pinB = pins.find((p) => Number.parseInt(p.number, 10) === b)
    if (!pinA || !pinB) return 0
    return pinB.y - pinA.y // Higher Y = higher on screen in KiCad
  }

  const sortByX = (a: number, b: number) => {
    const pinA = pins.find((p) => Number.parseInt(p.number, 10) === a)
    const pinB = pins.find((p) => Number.parseInt(p.number, 10) === b)
    if (!pinA || !pinB) return 0
    return pinA.x - pinB.x
  }

  arrangement.leftSide.pins.sort(sortByY)
  arrangement.rightSide.pins.sort(sortByY)
  arrangement.topSide.pins.sort(sortByX)
  arrangement.bottomSide.pins.sort(sortByX)

  return { pinLabels, schPortArrangement: arrangement, pins }
}
