import parseSExpression from "s-expression"

export interface KicadSymPin {
  name: string
  number: string
  rotation: number
  x: number
  y: number
}

export interface TscircuitSchematicProps {
  pinLabels: Record<string, string>
  schPortArrangement: {
    leftSide?: { pins: string[]; arrangement?: string }
    rightSide?: { pins: string[]; arrangement?: string }
    topSide?: { pins: string[]; arrangement?: string }
    bottomSide?: { pins: string[]; arrangement?: string }
  }
}

/**
 * Recursively find all sub-expressions with a given leading keyword.
 */
function findSubExpressions(
  expr: any[],
  key: string,
  recursive = true,
): any[][] {
  const results: any[][] = []
  for (const item of expr) {
    if (!Array.isArray(item)) continue
    if (item[0]?.toString() === key) {
      results.push(item)
    }
    if (recursive) {
      results.push(...findSubExpressions(item.slice(1), key, true))
    }
  }
  return results
}

/**
 * Find the first direct child sub-expression with the given keyword.
 */
function getSubExpr(expr: any[], key: string): any[] | undefined {
  for (const item of expr) {
    if (Array.isArray(item) && item[0]?.toString() === key) {
      return item
    }
  }
  return undefined
}

/**
 * Parse a .kicad_sym file and return tscircuit schematic properties:
 * - `pinLabels`: maps pin number → pin name
 * - `schPortArrangement`: which pins appear on each side of the chip symbol
 *
 * KiCad pin rotation convention:
 *   0°   → stub points right  → pin is on the LEFT  side
 *   180° → stub points left   → pin is on the RIGHT side
 *   90°  → stub points up     → pin is on the BOTTOM
 *   270° → stub points down   → pin is on the TOP
 *
 * @param fileContent  Raw text content of a .kicad_sym file
 * @param symbolName   Optional: which symbol to extract (defaults to first)
 */
export function parseKicadSymToTscircuit(
  fileContent: string,
  symbolName?: string,
): TscircuitSchematicProps {
  const parsed = parseSExpression(fileContent)

  if (parsed[0]?.toString() !== "kicad_symbol_lib") {
    throw new Error(
      `Expected kicad_symbol_lib, got "${parsed[0]}" — is this a .kicad_sym file?`,
    )
  }

  // Top-level symbol entries: (symbol "Name" ...)
  const topLevelSymbols = parsed
    .slice(1)
    .filter(
      (item: any) => Array.isArray(item) && item[0]?.toString() === "symbol",
    )

  let targetSymbol: any[]
  if (symbolName) {
    targetSymbol = topLevelSymbols.find(
      (s: any[]) => s[1]?.toString() === symbolName,
    )
    if (!targetSymbol) {
      throw new Error(
        `Symbol "${symbolName}" not found. Available: ${topLevelSymbols.map((s: any[]) => s[1]).join(", ")}`,
      )
    }
  } else {
    targetSymbol = topLevelSymbols[0]
    if (!targetSymbol)
      throw new Error("No symbols found in the .kicad_sym file")
  }

  // Recursively collect all pin entries, including from sub-symbol units
  const pinExprs = findSubExpressions(targetSymbol.slice(2), "pin")

  const pins: KicadSymPin[] = []

  for (const pin of pinExprs) {
    // ["pin", type, graphicStyle, ["at", x, y, rotation], ["length", l],
    //   ["name", str, ...], ["number", str, ...]]
    const atExpr = getSubExpr(pin.slice(3), "at")
    const nameExpr = getSubExpr(pin.slice(3), "name")
    const numberExpr = getSubExpr(pin.slice(3), "number")

    if (!atExpr || !nameExpr || !numberExpr) continue

    const x = Number.parseFloat(atExpr[1]?.toString() ?? "0")
    const y = Number.parseFloat(atExpr[2]?.toString() ?? "0")
    const rotation = Number.parseFloat(atExpr[3]?.toString() ?? "0")
    const name = nameExpr[1]?.toString() ?? ""
    const number = numberExpr[1]?.toString() ?? ""

    // Skip no-connect / hidden pin stubs
    if (name === "~" || number === "~" || name === "" || number === "") continue

    pins.push({ name, number, rotation, x, y })
  }

  // Deduplicate by pin number (multi-unit symbols repeat pins)
  const seen = new Set<string>()
  const uniquePins = pins.filter((p) => {
    if (seen.has(p.number)) return false
    seen.add(p.number)
    return true
  })

  // Build pinLabels
  const pinLabels: Record<string, string> = {}
  for (const pin of uniquePins) {
    pinLabels[pin.number] = pin.name
  }

  // Classify pins by side using KiCad rotation convention
  const leftPins: string[] = []
  const rightPins: string[] = []
  const topPins: string[] = []
  const bottomPins: string[] = []

  for (const pin of uniquePins) {
    const rot = ((pin.rotation % 360) + 360) % 360
    if (rot === 0) {
      leftPins.push(pin.number)
    } else if (rot === 180) {
      rightPins.push(pin.number)
    } else if (rot === 90) {
      bottomPins.push(pin.number)
    } else if (rot === 270) {
      topPins.push(pin.number)
    } else {
      // Fallback: use X position to decide left vs right
      if (pin.x <= 0) leftPins.push(pin.number)
      else rightPins.push(pin.number)
    }
  }

  const schPortArrangement: TscircuitSchematicProps["schPortArrangement"] = {}

  if (leftPins.length > 0) {
    schPortArrangement.leftSide = {
      pins: leftPins,
      arrangement: "evenly-distributed",
    }
  }
  if (rightPins.length > 0) {
    schPortArrangement.rightSide = {
      pins: rightPins,
      arrangement: "evenly-distributed",
    }
  }
  if (topPins.length > 0) {
    schPortArrangement.topSide = {
      pins: topPins,
      arrangement: "evenly-distributed",
    }
  }
  if (bottomPins.length > 0) {
    schPortArrangement.bottomSide = {
      pins: bottomPins,
      arrangement: "evenly-distributed",
    }
  }

  return { pinLabels, schPortArrangement }
}
