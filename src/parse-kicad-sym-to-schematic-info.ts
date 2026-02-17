import parseSExpression from "s-expression"

/**
 * Parsed pin from a kicad_sym file.
 */
export interface KicadSymPin {
  name: string
  number: string
  electricalType: string
  at: [number, number, number?]
  length: number
}

/**
 * Result of parsing a kicad_sym file for schematic info.
 */
export interface SchematicInfo {
  pinLabels: Record<string, string>
  schPinArrangement: {
    left_side?: { pins: number[]; direction: "top-to-bottom" }
    right_side?: { pins: number[]; direction: "top-to-bottom" }
    top_side?: { pins: number[]; direction: "left-to-right" }
    bottom_side?: { pins: number[]; direction: "left-to-right" }
  }
}

/**
 * Parse a kicad_sym file and extract pin labels + schematic port arrangement.
 *
 * KiCad symbol files contain pin positions with rotation angles that indicate
 * which side of the component body the pin extends from:
 *   0   -> pin points right -> placed on LEFT side
 *   90  -> pin points up    -> placed on BOTTOM side
 *   180 -> pin points left  -> placed on RIGHT side
 *   270 -> pin points down  -> placed on TOP side
 */
export function parseKicadSymToSchematicInfo(
  fileContent: string,
): SchematicInfo {
  const sexpr = parseSExpression(fileContent)

  if (sexpr[0] !== "kicad_symbol_lib") {
    throw new Error("Invalid kicad_sym file: missing kicad_symbol_lib root")
  }

  // Collect all pins from all symbols (including sub-units)
  const allPins: KicadSymPin[] = []
  collectPinsFromSExpr(sexpr, allPins)

  // Deduplicate by pin number (sub-units can repeat pins)
  const seenNumbers = new Set<string>()
  const uniquePins: KicadSymPin[] = []
  for (const pin of allPins) {
    if (!seenNumbers.has(pin.number)) {
      seenNumbers.add(pin.number)
      uniquePins.push(pin)
    }
  }

  // Build pinLabels: { "pin1": "VCC", "pin2": "GND", ... }
  // Skip pins with name "~" (hidden / unnamed pins like on a resistor)
  const pinLabels: Record<string, string> = {}
  for (const pin of uniquePins) {
    if (pin.number && pin.name && pin.name !== "~") {
      pinLabels[`pin${pin.number}`] = pin.name
    }
  }

  // Categorize pins by side based on rotation angle
  const left: number[] = []
  const right: number[] = []
  const top: number[] = []
  const bottom: number[] = []

  for (const pin of uniquePins) {
    const rotation = (((pin.at[2] ?? 0) % 360) + 360) % 360
    const pinNum = Number(pin.number)
    if (Number.isNaN(pinNum)) continue

    if (rotation === 0) {
      left.push(pinNum)
    } else if (rotation === 90) {
      bottom.push(pinNum)
    } else if (rotation === 180) {
      right.push(pinNum)
    } else if (rotation === 270) {
      top.push(pinNum)
    } else {
      // Non-standard rotation: fall back to position-based heuristic
      const x = pin.at[0]
      if (x <= 0) left.push(pinNum)
      else right.push(pinNum)
    }
  }

  // Sort pins by their perpendicular coordinate for natural visual ordering
  const sortByY = (pinIds: number[]) => {
    return pinIds.sort((a, b) => {
      const pinA = uniquePins.find((p) => p.number === String(a))
      const pinB = uniquePins.find((p) => p.number === String(b))
      if (!pinA || !pinB) return 0
      // KiCad Y: higher Y value = visually higher on the schematic
      return pinB.at[1] - pinA.at[1]
    })
  }

  const sortByX = (pinIds: number[]) => {
    return pinIds.sort((a, b) => {
      const pinA = uniquePins.find((p) => p.number === String(a))
      const pinB = uniquePins.find((p) => p.number === String(b))
      if (!pinA || !pinB) return 0
      return pinA.at[0] - pinB.at[0]
    })
  }

  sortByY(left)
  sortByY(right)
  sortByX(top)
  sortByX(bottom)

  const schPinArrangement: SchematicInfo["schPinArrangement"] = {}
  if (left.length > 0) {
    schPinArrangement.left_side = { pins: left, direction: "top-to-bottom" }
  }
  if (right.length > 0) {
    schPinArrangement.right_side = { pins: right, direction: "top-to-bottom" }
  }
  if (top.length > 0) {
    schPinArrangement.top_side = { pins: top, direction: "left-to-right" }
  }
  if (bottom.length > 0) {
    schPinArrangement.bottom_side = {
      pins: bottom,
      direction: "left-to-right",
    }
  }

  return { pinLabels, schPinArrangement }
}

/**
 * Recursively walk the S-expression tree to find all (pin ...) nodes.
 */
function collectPinsFromSExpr(node: any, out: KicadSymPin[]): void {
  if (!Array.isArray(node)) return

  if (node[0] === "pin") {
    const pin = parsePinNode(node)
    if (pin) out.push(pin)
    return
  }

  for (const child of node) {
    collectPinsFromSExpr(child, out)
  }
}

/**
 * Parse a single (pin ...) s-expression node.
 *
 * Format:
 *   (pin electrical_type graphic_style
 *     (at X Y [ROTATION])
 *     (length LENGTH)
 *     (name "NAME" [(effects ...)])
 *     (number "NUM" [(effects ...)])
 *   )
 */
function parsePinNode(node: any[]): KicadSymPin | null {
  const electricalType = String(node[1]?.valueOf?.() ?? node[1] ?? "passive")
  // node[2] is graphic_style (line, inverted, etc.)

  let at: [number, number, number?] = [0, 0]
  let length = 2.54
  let name = ""
  let number = ""

  for (const attr of node.slice(3)) {
    if (!Array.isArray(attr)) continue
    const token = String(attr[0]?.valueOf?.() ?? attr[0])

    switch (token) {
      case "at":
        at = [
          Number.parseFloat(String(attr[1]?.valueOf?.() ?? 0)),
          Number.parseFloat(String(attr[2]?.valueOf?.() ?? 0)),
        ]
        if (attr[3] != null) {
          ;(at as any).push(
            Number.parseFloat(String(attr[3]?.valueOf?.() ?? 0)),
          )
        }
        break
      case "length":
        length = Number.parseFloat(String(attr[1]?.valueOf?.() ?? 2.54))
        break
      case "name":
        name = String(attr[1]?.valueOf?.() ?? "")
        break
      case "number":
        number = String(attr[1]?.valueOf?.() ?? "")
        break
    }
  }

  if (!number) return null

  return { name, number, electricalType, at, length }
}
