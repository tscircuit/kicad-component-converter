import parseSExpression from "s-expression"

/**
 * Minimal representation of a KiCad symbol (`.kicad_sym`) pin.
 *
 * KiCad symbol pins store their position and orientation in an
 * `(at X Y ANGLE)` node. The `ANGLE` is the direction the pin _points_
 * (away from the symbol body), which tells us which side of the symbol the
 * pin belongs to:
 *
 *   - 0   -> pin points right, so it sits on the LEFT side
 *   - 90  -> pin points up,    so it sits on the BOTTOM side
 *   - 180 -> pin points left,  so it sits on the RIGHT side
 *   - 270 -> pin points down,  so it sits on the TOP side
 */
export type KicadSymPinSide = "left" | "right" | "top" | "bottom"

export interface KicadSymPin {
  number: string
  name: string
  x: number
  y: number
  angle: number
  side: KicadSymPinSide
}

export interface KicadSymSymbol {
  name: string
  pins: KicadSymPin[]
}

/**
 * The `s-expression` parser returns boxed `String` objects for atoms. This
 * helper normalizes any node value to a plain primitive string so we can
 * compare/parse it safely.
 */
const atom = (value: any): string => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value.valueOf === "function") return String(value.valueOf())
  return String(value)
}

const isNode = (value: any): value is any[] => Array.isArray(value)

const findChild = (node: any[], key: string): any[] | undefined =>
  node.find((child) => isNode(child) && atom(child[0]) === key) as
    | any[]
    | undefined

const angleToSide = (angle: number): KicadSymPinSide => {
  // Snap to the nearest cardinal orientation to be robust against floats.
  const snapped = (((Math.round(angle / 90) * 90) % 360) + 360) % 360
  switch (snapped) {
    case 0:
      return "left"
    case 90:
      return "bottom"
    case 180:
      return "right"
    case 270:
      return "top"
    default:
      return "left"
  }
}

/** Recursively collect every `pin` node nested under a symbol (across units). */
const collectPins = (node: any[], acc: KicadSymPin[]) => {
  for (const child of node) {
    if (!isNode(child)) continue

    if (atom(child[0]) === "pin") {
      const at = findChild(child, "at")
      const x = at ? Number.parseFloat(atom(at[1])) : 0
      const y = at ? Number.parseFloat(atom(at[2])) : 0
      const angle = at ? Number.parseFloat(atom(at[3] ?? "0")) : 0
      const nameNode = findChild(child, "name")
      const numberNode = findChild(child, "number")

      acc.push({
        number: numberNode ? atom(numberNode[1]) : "",
        name: nameNode ? atom(nameNode[1]) : "",
        x,
        y,
        angle,
        side: angleToSide(angle),
      })
    } else {
      collectPins(child, acc)
    }
  }
}

/**
 * Parse the contents of a `.kicad_sym` file into a list of symbols, each with
 * its pins (number, name, position and resolved side).
 */
export const parseKicadSymToKicadJson = (
  fileContent: string,
): KicadSymSymbol[] => {
  const root = parseSExpression(fileContent) as any[]

  if (!isNode(root)) return []

  const symbols: KicadSymSymbol[] = []
  for (const child of root) {
    if (isNode(child) && atom(child[0]) === "symbol") {
      const pins: KicadSymPin[] = []
      collectPins(child, pins)
      symbols.push({ name: atom(child[1]), pins })
    }
  }
  return symbols
}
