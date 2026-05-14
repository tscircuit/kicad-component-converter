import parseSExpression from "s-expression"

export type PinSide = "leftSide" | "rightSide" | "topSide" | "bottomSide"

export interface SchPortSide {
  pins: string[]
  direction:
    | "top-to-bottom"
    | "left-to-right"
    | "bottom-to-top"
    | "right-to-left"
}

export interface KicadSymSchematicMetadata {
  pinLabels: Record<string, string>
  schPortArrangement: Partial<Record<PinSide, SchPortSide>>
}

interface ParsedPin {
  pinKey: string
  name: string
  x: number
  y: number
  side: PinSide
}

/** KiCad pin rotation → which side of the symbol the pin connects to */
function rotationToSide(rotation: number): PinSide {
  const normalized = ((Math.round(rotation) % 360) + 360) % 360
  if (normalized === 180) return "rightSide"
  if (normalized === 90) return "bottomSide"
  if (normalized === 270) return "topSide"
  return "leftSide" // 0° default
}

function nodeTag(node: any): string | undefined {
  if (!Array.isArray(node) || node.length === 0) return undefined
  const first = node[0]
  if (typeof first === "string") return first
  if (first && typeof first.valueOf === "function") {
    const v = first.valueOf()
    return typeof v === "string" ? v : undefined
  }
  return undefined
}

function findChildren(node: any[], tag: string): any[][] {
  return node.slice(1).filter((child) => nodeTag(child) === tag) as any[][]
}

function stringVal(node: any): string {
  if (typeof node === "string") return node
  if (node && typeof node.valueOf === "function") return String(node.valueOf())
  return String(node)
}

function numVal(node: any): number {
  return Number.parseFloat(stringVal(node))
}

/** Extract all pins from a parsed kicad_sym S-expression node (recursively). */
function extractPins(node: any, acc: ParsedPin[] = []): ParsedPin[] {
  if (!Array.isArray(node)) return acc
  const tag = nodeTag(node)

  if (tag === "pin") {
    // Skip no_connect / invisible pins
    const isHidden = node.some(
      (child) =>
        (typeof child === "string" && child === "hide") ||
        (child &&
          typeof child.valueOf === "function" &&
          child.valueOf() === "hide"),
    )
    const pinType = node.length > 1 ? stringVal(node[1]) : ""
    if (!isHidden && pinType !== "no_connect") {
      // (at x y rotation)
      const atNode = findChildren(node, "at")[0]
      const x = atNode ? numVal(atNode[1]) : 0
      const y = atNode ? numVal(atNode[2]) : 0
      const rotation = atNode && atNode.length >= 4 ? numVal(atNode[3]) : 0

      // (number "N" ...)
      const numberNode = findChildren(node, "number")[0]
      const pinNumber = numberNode ? stringVal(numberNode[1]) : "?"

      // (name "Label" ...)
      const nameNode = findChildren(node, "name")[0]
      const pinName = nameNode ? stringVal(nameNode[1]) : pinNumber

      acc.push({
        pinKey: `pin${pinNumber}`,
        name: pinName,
        x,
        y,
        side: rotationToSide(rotation),
      })
    }
    return acc
  }

  // Recurse into children (skip deep nesting inside a pin node — already handled above)
  for (const child of node.slice(1)) {
    extractPins(child, acc)
  }
  return acc
}

const SIDE_DIRECTIONS: Record<PinSide, SchPortSide["direction"]> = {
  leftSide: "top-to-bottom",
  rightSide: "top-to-bottom",
  topSide: "left-to-right",
  bottomSide: "left-to-right",
}

function sortPins(side: PinSide, pins: ParsedPin[]): ParsedPin[] {
  if (side === "leftSide" || side === "rightSide") {
    // KiCad Y increases downward; schematic Y typically increases downward too
    // Sort ascending by Y so higher pins appear first (top-to-bottom)
    return [...pins].sort((a, b) => b.y - a.y)
  }
  // topSide / bottomSide: sort left-to-right by X
  return [...pins].sort((a, b) => a.x - b.x)
}

/**
 * Parse a `.kicad_sym` file and produce schematic metadata including
 * `pinLabels` and `schPortArrangement`.
 */
export function parseKicadSymToSchematicMetadata(
  kicadSym: string,
): KicadSymSchematicMetadata {
  const parsed = parseSExpression(kicadSym)
  const pins = extractPins(parsed)

  const pinLabels: Record<string, string> = {}
  const bySide: Partial<Record<PinSide, ParsedPin[]>> = {}

  for (const pin of pins) {
    pinLabels[pin.pinKey] = pin.name
    bySide[pin.side] ??= []
    bySide[pin.side]!.push(pin)
  }

  const schPortArrangement: Partial<Record<PinSide, SchPortSide>> = {}
  for (const [side, sidePins] of Object.entries(bySide) as [
    PinSide,
    ParsedPin[],
  ][]) {
    const sorted = sortPins(side, sidePins)
    schPortArrangement[side] = {
      pins: sorted.map((p) => p.pinKey),
      direction: SIDE_DIRECTIONS[side],
    }
  }

  return { pinLabels, schPortArrangement }
}
