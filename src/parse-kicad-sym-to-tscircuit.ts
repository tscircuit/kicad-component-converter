import parseSExpression from "s-expression"

export type SchPortArrangement = {
  leftSide?: { pins: number[] }
  rightSide?: { pins: number[] }
  topSide?: { pins: number[] }
  bottomSide?: { pins: number[] }
}

export type KicadSymTscircuitOutput = {
  /** Maps pin number (string) to pin label/name */
  pinLabels: Record<string, string>
  /** Arrangement of pins around the schematic symbol */
  schPortArrangement: SchPortArrangement
}

type ParsedPin = {
  number: string
  name: string
  /** KiCad pin angle: 0=right(→left side), 180=left(→right), 90=up(→bottom), 270=down(→top) */
  angle: number
}

/**
 * Recursively traverses an s-expression tree and collects all `(pin ...)` entries.
 */
function collectPins(node: any[]): ParsedPin[] {
  const pins: ParsedPin[] = []

  if (!Array.isArray(node)) return pins

  for (const child of node) {
    if (!Array.isArray(child)) continue

    const tag = String(child[0])

    if (tag === "pin") {
      // (pin <elec_type> <graphic_type> (at X Y ANGLE) (length L)
      //   (name "..." ...) (number "..." ...) )
      const atEntry = child.find(
        (c: any) => Array.isArray(c) && String(c[0]) === "at",
      )
      const nameEntry = child.find(
        (c: any) => Array.isArray(c) && String(c[0]) === "name",
      )
      const numberEntry = child.find(
        (c: any) => Array.isArray(c) && String(c[0]) === "number",
      )

      if (!atEntry || !nameEntry || !numberEntry) continue

      const angle = Number(atEntry[3]) ?? 0
      const name = String(nameEntry[1])
      const number = String(numberEntry[1])

      // Skip no-connect pins (name "~" or number "~")
      if (name === "~" && number === "~") continue

      pins.push({ number, name, angle })
    } else {
      // Recurse into sub-symbols and other nodes
      pins.push(...collectPins(child))
    }
  }

  return pins
}

/**
 * Maps a KiCad pin angle to the schematic symbol side.
 *
 * In KiCad, the pin angle is the direction the stub *points*:
 *   0°  → stub points right  → pin is on the LEFT  side of the body
 *  90°  → stub points up     → pin is on the BOTTOM side (Y-down convention)
 * 180°  → stub points left   → pin is on the RIGHT side
 * 270°  → stub points down   → pin is on the TOP   side
 */
function angleToSide(angle: number): "leftSide" | "rightSide" | "topSide" | "bottomSide" {
  const normalized = ((angle % 360) + 360) % 360
  if (normalized === 0) return "leftSide"
  if (normalized === 90) return "bottomSide"
  if (normalized === 180) return "rightSide"
  if (normalized === 270) return "topSide"
  // Non-standard angle — fall back by quadrant
  if (normalized < 90) return "leftSide"
  if (normalized < 180) return "bottomSide"
  if (normalized < 270) return "rightSide"
  return "topSide"
}

/**
 * Parse a `.kicad_sym` file and return `pinLabels` + `schPortArrangement`
 * suitable for use with the tscircuit `<chip>` component.
 *
 * @param fileContent - Raw text content of the `.kicad_sym` file
 * @param symbolName  - Optional: pick a specific symbol by name when the
 *                      library contains multiple symbols. Defaults to the
 *                      first symbol found.
 */
export function parseKicadSymToTscircuit(
  fileContent: string,
  symbolName?: string,
): KicadSymTscircuitOutput {
  const sExpr = parseSExpression(fileContent)

  // Locate the requested (or first) top-level symbol entry
  const symbols = sExpr
    .slice(1)
    .filter((node: any) => Array.isArray(node) && String(node[0]) === "symbol")

  if (symbols.length === 0) {
    throw new Error("No symbol definitions found in kicad_sym file")
  }

  let symbolNode: any[]
  if (symbolName) {
    symbolNode = symbols.find((s: any) => String(s[1]) === symbolName)
    if (!symbolNode) {
      throw new Error(
        `Symbol "${symbolName}" not found. Available: ${symbols.map((s: any) => String(s[1])).join(", ")}`,
      )
    }
  } else {
    symbolNode = symbols[0]
  }

  // Collect all pins, deduplicating by pin number (multi-unit symbols repeat
  // the same physical pin across units)
  const allPins = collectPins(symbolNode)
  const seenNumbers = new Set<string>()
  const uniquePins: ParsedPin[] = []
  for (const pin of allPins) {
    if (!seenNumbers.has(pin.number)) {
      seenNumbers.add(pin.number)
      uniquePins.push(pin)
    }
  }

  // Build pinLabels: { "1": "GND", "2": "TRIG", ... }
  const pinLabels: Record<string, string> = {}
  for (const pin of uniquePins) {
    pinLabels[pin.number] = pin.name
  }

  // Group pin numbers by schematic side
  const sideMap: Record<string, number[]> = {
    leftSide: [],
    rightSide: [],
    topSide: [],
    bottomSide: [],
  }
  for (const pin of uniquePins) {
    const side = angleToSide(pin.angle)
    sideMap[side].push(Number(pin.number))
  }

  // Sort pins on each side by pin number for deterministic output
  for (const side of Object.keys(sideMap)) {
    sideMap[side].sort((a, b) => a - b)
  }

  const schPortArrangement: SchPortArrangement = {}
  if (sideMap.leftSide.length > 0)
    schPortArrangement.leftSide = { pins: sideMap.leftSide }
  if (sideMap.rightSide.length > 0)
    schPortArrangement.rightSide = { pins: sideMap.rightSide }
  if (sideMap.topSide.length > 0)
    schPortArrangement.topSide = { pins: sideMap.topSide }
  if (sideMap.bottomSide.length > 0)
    schPortArrangement.bottomSide = { pins: sideMap.bottomSide }

  return { pinLabels, schPortArrangement }
}
