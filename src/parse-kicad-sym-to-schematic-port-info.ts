import parseSExpression from "s-expression"

export interface KicadSymPin {
  number: string
  name: string
  x: number
  y: number
  angle: number
  electrical_type: string
}

export interface SchematicPortInfo {
  port_arrangement: {
    left_side?: {
      pins: number[]
      direction?: "top-to-bottom" | "bottom-to-top"
    }
    right_side?: {
      pins: number[]
      direction?: "top-to-bottom" | "bottom-to-top"
    }
    top_side?: {
      pins: number[]
      direction?: "left-to-right" | "right-to-left"
    }
    bottom_side?: {
      pins: number[]
      direction?: "left-to-right" | "right-to-left"
    }
  }
  port_labels: Record<string, string>
}

/**
 * Maps a KiCad pin angle (degrees, CCW from +X) to which side of the
 * component box the pin's wire-end lies on.
 *
 * KiCad convention:
 *   angle = 0   → pin body points RIGHT  → wire end is on the LEFT
 *   angle = 90  → pin body points UP     → wire end is on the BOTTOM
 *   angle = 180 → pin body points LEFT   → wire end is on the RIGHT
 *   angle = 270 → pin body points DOWN   → wire end is on the TOP
 */
const angleToSide = (
  angle: number,
): "left" | "right" | "top" | "bottom" => {
  const n = ((angle % 360) + 360) % 360
  if (n < 45 || n >= 315) return "left"
  if (n < 135) return "bottom"
  if (n < 225) return "right"
  return "top"
}

const toNumber = (v: any): number => {
  const s = typeof v === "object" && v !== null ? v.valueOf() : v
  return parseFloat(String(s))
}

const toString = (v: any): string => {
  if (v === undefined || v === null) return ""
  if (typeof v === "object" && typeof v.valueOf === "function") {
    return String(v.valueOf())
  }
  return String(v)
}

/**
 * Recursively walks an S-expression list and collects all `(pin ...)` nodes.
 * Also recurses into `(symbol ...)` sub-nodes.
 */
const collectPins = (list: any[]): KicadSymPin[] => {
  const pins: KicadSymPin[] = []
  for (const item of list) {
    if (!Array.isArray(item)) continue
    const tag = toString(item[0])

    if (tag === "pin") {
      // Structure: (pin electrical_type graphical_style (at x y angle) (length n) (name "...") (number "..."))
      const electrical_type = toString(item[1])
      let x = 0
      let y = 0
      let angle = 0
      let pinName = ""
      let pinNumber = ""

      for (const attr of item.slice(3)) {
        if (!Array.isArray(attr)) continue
        const key = toString(attr[0])
        if (key === "at") {
          x = toNumber(attr[1])
          y = toNumber(attr[2])
          angle = attr[3] !== undefined ? toNumber(attr[3]) : 0
        } else if (key === "name") {
          pinName = toString(attr[1])
        } else if (key === "number") {
          pinNumber = toString(attr[1])
        }
      }

      if (pinNumber !== "") {
        pins.push({
          number: pinNumber,
          name: pinName || pinNumber,
          x,
          y,
          angle,
          electrical_type,
        })
      }
    } else if (tag === "symbol") {
      // Recurse into sub-symbols (e.g. "Component_0_1", "Component_1_1")
      pins.push(...collectPins(item.slice(1)))
    }
  }
  return pins
}

/**
 * Parse a KiCad symbol file (`.kicad_sym`) or a bare `(symbol ...)` block
 * and return the `port_arrangement` and `port_labels` needed to populate a
 * tscircuit `schematic_component`.
 *
 * Accepts both:
 *  - Full library files starting with `(kicad_symbol_lib ...)`
 *  - Standalone symbol blocks starting with `(symbol ...)`
 */
export const parseKicadSymToSchematicPortInfo = (
  kicadSym: string,
): SchematicPortInfo => {
  const parsed = parseSExpression(kicadSym.trim())

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { port_arrangement: {}, port_labels: {} }
  }

  const rootTag = toString(parsed[0])

  let pins: KicadSymPin[] = []

  if (rootTag === "kicad_symbol_lib") {
    // Find top-level (symbol ...) nodes inside the library
    for (const item of parsed.slice(1)) {
      if (!Array.isArray(item)) continue
      if (toString(item[0]) === "symbol") {
        pins.push(...collectPins(item.slice(1)))
      }
    }
  } else if (rootTag === "symbol") {
    pins.push(...collectPins(parsed.slice(1)))
  }

  // Group pins by side
  const left: KicadSymPin[] = []
  const right: KicadSymPin[] = []
  const top: KicadSymPin[] = []
  const bottom: KicadSymPin[] = []

  for (const pin of pins) {
    switch (angleToSide(pin.angle)) {
      case "left":
        left.push(pin)
        break
      case "right":
        right.push(pin)
        break
      case "top":
        top.push(pin)
        break
      case "bottom":
        bottom.push(pin)
        break
    }
  }

  // Left / right: sort top-to-bottom (ascending y in KiCad = top of screen first)
  const byY = (a: KicadSymPin, b: KicadSymPin) => a.y - b.y
  // Top / bottom: sort left-to-right (ascending x)
  const byX = (a: KicadSymPin, b: KicadSymPin) => a.x - b.x

  left.sort(byY)
  right.sort(byY)
  top.sort(byX)
  bottom.sort(byX)

  const toIntPins = (arr: KicadSymPin[]): number[] =>
    arr
      .map((p) => parseInt(p.number, 10))
      .filter((n) => !Number.isNaN(n))

  const port_arrangement: SchematicPortInfo["port_arrangement"] = {}

  if (left.length > 0) {
    port_arrangement.left_side = {
      pins: toIntPins(left),
      direction: "top-to-bottom",
    }
  }
  if (right.length > 0) {
    port_arrangement.right_side = {
      pins: toIntPins(right),
      direction: "top-to-bottom",
    }
  }
  if (top.length > 0) {
    port_arrangement.top_side = {
      pins: toIntPins(top),
      direction: "left-to-right",
    }
  }
  if (bottom.length > 0) {
    port_arrangement.bottom_side = {
      pins: toIntPins(bottom),
      direction: "left-to-right",
    }
  }

  // Build port_labels: "pin1" -> "CLK", etc.
  // Only include a label when the pin name is distinct from its number.
  const port_labels: Record<string, string> = {}
  for (const pin of pins) {
    const num = parseInt(pin.number, 10)
    if (Number.isNaN(num)) continue
    if (pin.name && pin.name !== pin.number) {
      port_labels[`pin${num}`] = pin.name
    }
  }

  return { port_arrangement, port_labels }
}
