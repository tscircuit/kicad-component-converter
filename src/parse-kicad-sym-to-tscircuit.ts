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
  /** Component name from the symbol file */
  componentName: string
}

type ParsedPin = {
  number: string
  name: string
  /**
   * KiCad pin angle: the direction the pin stub points:
   *   0°   → stub points right  → pin is on the LEFT  side
   *  90°   → stub points up     → pin is on the BOTTOM side (Y-down)
   * 180°   → stub points left   → pin is on the RIGHT side
   * 270°   → stub points down   → pin is on the TOP   side
   */
  angle: number
}

/**
 * Recursively traverse an s-expression tree and collect all `(pin ...)` nodes.
 */
function collectPins(node: unknown[]): ParsedPin[] {
  const pins: ParsedPin[] = []
  if (!Array.isArray(node)) return pins

  for (const child of node) {
    if (!Array.isArray(child)) continue

    const tag = String(child[0])

    if (tag === "pin") {
      // (pin <elec_type> <graphic_type> (at X Y ANGLE) (length L)
      //   (name "...") (number "...") )
      const atEntry = child.find(
        (c: unknown) => Array.isArray(c) && String((c as unknown[])[0]) === "at",
      ) as unknown[] | undefined
      const nameEntry = child.find(
        (c: unknown) => Array.isArray(c) && String((c as unknown[])[0]) === "name",
      ) as unknown[] | undefined
      const numberEntry = child.find(
        (c: unknown) =>
          Array.isArray(c) && String((c as unknown[])[0]) === "number",
      ) as unknown[] | undefined

      if (!atEntry || !nameEntry || !numberEntry) continue

      const angle = Number(atEntry[3]) ?? 0
      const name = String(nameEntry[1])
      const number = String(numberEntry[1])

      // Skip degenerate pins
      if (name === "~" && number === "~") continue

      pins.push({ number, name, angle })
    } else {
      pins.push(...collectPins(child as unknown[]))
    }
  }

  return pins
}

/**
 * Map a KiCad pin stub angle to a schematic side.
 */
function angleToSide(
  angle: number,
): "leftSide" | "rightSide" | "topSide" | "bottomSide" {
  const n = ((angle % 360) + 360) % 360
  if (n === 0) return "leftSide"
  if (n === 90) return "bottomSide"
  if (n === 180) return "rightSide"
  if (n === 270) return "topSide"
  // Non-cardinal fallback by quadrant
  if (n < 90) return "leftSide"
  if (n < 180) return "bottomSide"
  if (n < 270) return "rightSide"
  return "topSide"
}

/**
 * Parse a `.kicad_sym` file content and return `pinLabels` and
 * `schPortArrangement` ready for use with the tscircuit `<chip>` component.
 *
 * @param content - Raw text content of a `.kicad_sym` file
 * @param symbolName - Optional symbol name to select when file contains multiple symbols;
 *                     defaults to first symbol found
 */
export function parseKicadSymToTscircuit(
  content: string,
  symbolName?: string,
): KicadSymTscircuitOutput {
  const tree = parseSExpression(content) as unknown[]

  if (!Array.isArray(tree) || String(tree[0]) !== "kicad_symbol_lib") {
    throw new Error(
      "Invalid .kicad_sym file: expected root element `kicad_symbol_lib`",
    )
  }

  // Find all top-level symbol entries
  const symbolEntries = (tree as unknown[]).filter(
    (node): node is unknown[] =>
      Array.isArray(node) && String((node as unknown[])[0]) === "symbol",
  )

  if (symbolEntries.length === 0) {
    throw new Error("No symbols found in .kicad_sym file")
  }

  // Pick the target symbol
  let target: unknown[]
  if (symbolName) {
    const found = symbolEntries.find(
      (s) => String((s as unknown[])[1]) === symbolName,
    )
    if (!found) {
      throw new Error(`Symbol '${symbolName}' not found in file`)
    }
    target = found as unknown[]
  } else {
    // Use the first top-level symbol (skip sub-symbol entries like "NE555_0_1")
    const topLevel = symbolEntries.find((s) => {
      const name = String((s as unknown[])[1])
      return !name.includes("_") || symbolEntries.length === 1
    })
    target = (topLevel ?? symbolEntries[0]) as unknown[]
  }

  const componentName = String((target as unknown[])[1])

  // Collect all pins (including from sub-symbols)
  const rawPins = collectPins(target as unknown[])

  // Deduplicate by pin number (keep first occurrence)
  const seen = new Set<string>()
  const pins: ParsedPin[] = []
  for (const pin of rawPins) {
    if (!seen.has(pin.number)) {
      seen.add(pin.number)
      pins.push(pin)
    }
  }

  // Build pinLabels
  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    // Use name if meaningful, otherwise fall back to pin number
    pinLabels[pin.number] =
      pin.name && pin.name !== "~" ? pin.name : pin.number
  }

  // Build schPortArrangement
  const sides: Record<
    "leftSide" | "rightSide" | "topSide" | "bottomSide",
    number[]
  > = {
    leftSide: [],
    rightSide: [],
    topSide: [],
    bottomSide: [],
  }

  for (const pin of pins) {
    const side = angleToSide(pin.angle)
    const pinNum = Number(pin.number)
    if (!Number.isNaN(pinNum)) {
      sides[side].push(pinNum)
    }
  }

  const schPortArrangement: SchPortArrangement = {}
  for (const [side, pinNums] of Object.entries(sides)) {
    if (pinNums.length > 0) {
      schPortArrangement[
        side as keyof SchPortArrangement
      ] = { pins: pinNums }
    }
  }

  return { pinLabels, schPortArrangement, componentName }
}
