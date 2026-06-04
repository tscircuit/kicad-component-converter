import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type PinSide = "left" | "right" | "top" | "bottom"

interface PinDef {
  name: string
  number: string
  x: number
  y: number
  /** KiCad rotation: direction the pin line points OUT FROM component body */
  rotation: number
  side: PinSide
}

/** Safely convert an S-expression symbol / string value to a plain string */
const textOf = (v: unknown): string => {
  if (v === undefined || v === null) return ""
  if (typeof v === "string") return v
  if (typeof (v as any).valueOf === "function")
    return String((v as any).valueOf())
  return String(v)
}

/** Find all nodes at any depth whose first element matches key */
const findNodes = (
  node: unknown,
  key: string,
  out: unknown[][] = [],
): unknown[][] => {
  if (!Array.isArray(node)) return out
  if (textOf((node as unknown[])[0]) === key) out.push(node as unknown[])
  for (const child of node as unknown[]) {
    if (Array.isArray(child)) findNodes(child, key, out)
  }
  return out
}

/** Return the first child node whose first element matches key */
const childNode = (parent: unknown[], key: string): unknown[] | undefined =>
  (parent as unknown[]).find(
    (child): child is unknown[] =>
      Array.isArray(child) && textOf((child as unknown[])[0]) === key,
  ) as unknown[] | undefined

/**
 * KiCad rotation convention: the rotation value on a (pin ...) node describes
 * the direction the pin line points *away from* the component body:
 *
 *   0   -> points left  -> pin is on the LEFT side
 *   90  -> points down  -> pin is on the BOTTOM side
 *   180 -> points right -> pin is on the RIGHT side
 *   270 -> points up    -> pin is on the TOP side
 */
const sideFromRotation = (rotDeg: number): PinSide => {
  const r = ((rotDeg % 360) + 360) % 360
  if (r === 180) return "right"
  if (r === 90) return "bottom"
  if (r === 270) return "top"
  return "left" // 0 and anything else
}

/** Parse a list of (pin ...) S-expression rows into PinDef objects */
const parsePinRows = (pinRows: unknown[][]): PinDef[] => {
  const pins: PinDef[] = []
  for (const row of pinRows) {
    const atRow = childNode(row as unknown[], "at")
    const nameRow = childNode(row as unknown[], "name")
    const numberRow = childNode(row as unknown[], "number")
    if (!atRow || !nameRow || !numberRow) continue

    const x = Number(textOf((atRow as unknown[])[1]))
    const y = -Number(textOf((atRow as unknown[])[2])) // flip Y axis
    const rotation = Number(textOf((atRow as unknown[])[3] ?? 0))

    pins.push({
      name: textOf((nameRow as unknown[])[1]),
      number: textOf((numberRow as unknown[])[1]),
      x,
      y,
      rotation,
      side: sideFromRotation(rotation),
    })
  }
  return pins
}

/**
 * Extract symbol name and all pin definitions from a parsed kicad_sym
 * S-expression.  Handles three common formats:
 *
 *   1. Top-level (symbol "Name" ...) - inline symbol, no library wrapper
 *   2. (kicad_symbol_lib ... (symbol "Name" ...) ...) - library file
 *   3. Nested sub-symbols: (symbol "Name" (symbol "Name_0_1" (pin ...)))
 */
const extractPins = (
  parsed: unknown[],
): { symbolName: string; pins: PinDef[] } => {
  const rootTag = textOf((parsed as unknown[])[0])

  // Case 1: the root node IS a (symbol "Name" ...) already
  if (rootTag === "symbol") {
    const symbolName = textOf((parsed as unknown[])[1]) || "KicadSymbol"
    return { symbolName, pins: parsePinRows(findNodes(parsed, "pin")) }
  }

  // Case 2: (kicad_symbol_lib ...) wrapper - find child (symbol ...) nodes
  if (rootTag === "kicad_symbol_lib") {
    const topSymbols = (parsed as unknown[]).filter(
      (child): child is unknown[] =>
        Array.isArray(child) && textOf((child as unknown[])[0]) === "symbol",
    ) as unknown[][]

    if (topSymbols.length === 0) return { symbolName: "KicadSymbol", pins: [] }

    // Prefer the first symbol whose name does NOT have a sub-symbol suffix (_N_M)
    const isPrimary = (node: unknown[]) =>
      !/_\d+_\d+$/.test(textOf((node as unknown[])[1]))
    const primary = topSymbols.find(isPrimary) ?? topSymbols[0]!
    const symbolName = textOf((primary as unknown[])[1]) || "KicadSymbol"
    return { symbolName, pins: parsePinRows(findNodes(primary, "pin")) }
  }

  // Fallback: search entire tree
  const anySymbols = findNodes(parsed, "symbol")
  if (anySymbols.length === 0) return { symbolName: "KicadSymbol", pins: [] }
  const primary = anySymbols[0]!
  return {
    symbolName: textOf((primary as unknown[])[1]) || "KicadSymbol",
    pins: parsePinRows(findNodes(primary, "pin")),
  }
}

/**
 * Parse a KiCad .kicad_sym file and return a circuit-JSON array suitable for
 * rendering the schematic view, including:
 *
 * - source_component   (one, named after the symbol)
 * - schematic_component (with schPortArrangement and pinLabels)
 * - source_port         (one per pin)
 * - schematic_port      (one per pin, positioned at the pin's x/y)
 *
 * @param kicadSym - raw text content of a .kicad_sym file
 */
export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const parsed: unknown[] = parseSExpression(kicadSym)
  const { symbolName, pins } = extractPins(parsed)

  const source_component_id = "source_component_0"
  const schematic_component_id = "schematic_component_0"

  // Bounding box of pin positions for sizing the schematic component
  const xs = pins.map((p) => p.x)
  const ys = pins.map((p) => p.y)
  const minX = xs.length ? Math.min(...xs) : -5
  const maxX = xs.length ? Math.max(...xs) : 5
  const minY = ys.length ? Math.min(...ys) : -5
  const maxY = ys.length ? Math.max(...ys) : 5

  const schPortArrangement = {
    leftSide: pins.filter((p) => p.side === "left").map((p) => p.number),
    rightSide: pins.filter((p) => p.side === "right").map((p) => p.number),
    topSide: pins.filter((p) => p.side === "top").map((p) => p.number),
    bottomSide: pins.filter((p) => p.side === "bottom").map((p) => p.number),
  }

  // Only include sides that have at least one pin to keep the object clean
  const compactArrangement = Object.fromEntries(
    Object.entries(schPortArrangement).filter(([, v]) => v.length > 0),
  ) as typeof schPortArrangement

  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    pinLabels[pin.number] = pin.name || pin.number
  }

  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id,
      name: symbolName,
      supplier_part_numbers: {},
    } as any,
    {
      type: "schematic_component",
      schematic_component_id,
      source_component_id,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      rotation: 0,
      size: {
        width: Math.max(10, maxX - minX + 10),
        height: Math.max(10, maxY - minY + 10),
      },
      schPortArrangement: compactArrangement,
      pinLabels,
    } as any,
  ]

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i]!
    const source_port_id = `source_port_${i}`
    const schematic_port_id = `schematic_port_${i}`
    const numericPinNumber = Number(pin.number)

    circuitJson.push({
      type: "source_port",
      source_port_id,
      source_component_id,
      name: pin.number,
      port_hints: [pin.number, pin.name].filter(Boolean),
      pin_number: Number.isFinite(numericPinNumber)
        ? numericPinNumber
        : undefined,
      pin_label: pin.name || pin.number,
    } as any)

    circuitJson.push({
      type: "schematic_port",
      schematic_port_id,
      schematic_component_id,
      source_port_id,
      center: { x: pin.x, y: pin.y },
      facingDirection: pin.side,
    } as any)
  }

  return circuitJson
}

/**
 * Enhance an existing circuit-JSON array (typically produced from a .kicad_mod
 * file) by overlaying schematic data from a .kicad_sym symbol file.
 *
 * The sym data provides:
 *  - schPortArrangement - which pins sit on left/right/top/bottom
 *  - pinLabels          - human-readable pin names keyed by pin number
 *
 * This is additive and non-destructive: PCB-specific elements are unchanged.
 *
 * @param circuitJson - existing circuit-JSON array from kicad_mod conversion
 * @param kicadSym    - raw text content of the accompanying .kicad_sym file
 */
export const enhanceCircuitJsonWithKicadSym = async (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const parsed: unknown[] = parseSExpression(kicadSym)
  const { pins } = extractPins(parsed)

  if (pins.length === 0) return circuitJson

  const schPortArrangement = {
    leftSide: pins.filter((p) => p.side === "left").map((p) => p.number),
    rightSide: pins.filter((p) => p.side === "right").map((p) => p.number),
    topSide: pins.filter((p) => p.side === "top").map((p) => p.number),
    bottomSide: pins.filter((p) => p.side === "bottom").map((p) => p.number),
  }

  const compactArrangement = Object.fromEntries(
    Object.entries(schPortArrangement).filter(([, v]) => v.length > 0),
  ) as typeof schPortArrangement

  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    pinLabels[pin.number] = pin.name || pin.number
  }

  // Map from pin number string -> pin name (for updating source_port labels)
  const pinNameByNumber = new Map(pins.map((p) => [p.number, p.name]))

  return circuitJson.map((element) => {
    if ((element as any).type === "schematic_component") {
      return {
        ...element,
        schPortArrangement: compactArrangement,
        pinLabels,
      }
    }
    if ((element as any).type === "source_port") {
      const el = element as any
      const pinName =
        pinNameByNumber.get(el.name) ??
        pinNameByNumber.get(String(el.pin_number))
      if (pinName) {
        return {
          ...el,
          pin_label: pinName,
          port_hints: [...new Set([...(el.port_hints ?? []), pinName])],
        }
      }
    }
    return element
  }) as AnyCircuitElement[]
}
