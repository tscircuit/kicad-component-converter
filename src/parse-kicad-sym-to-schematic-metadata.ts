import SParseModule from "s-expression"

const SParse = (SParseModule as any).default ?? SParseModule

export type SchPinArrangementSide = {
  pins: Array<string | number>
  direction:
    | "top-to-bottom"
    | "left-to-right"
    | "bottom-to-top"
    | "right-to-left"
}

export type SchPinArrangement = {
  leftSide?: SchPinArrangementSide
  topSide?: SchPinArrangementSide
  rightSide?: SchPinArrangementSide
  bottomSide?: SchPinArrangementSide
}

export type CircuitJsonPortArrangement = {
  left_side?: SchPinArrangementSide
  top_side?: SchPinArrangementSide
  right_side?: SchPinArrangementSide
  bottom_side?: SchPinArrangementSide
}

export type KicadSymbolSchematicMetadata = {
  pinLabels: Record<string, string>
  schPinArrangement: SchPinArrangement
  circuitJsonPortArrangement: CircuitJsonPortArrangement
}

type SExpr = string | number | String | Number | SExpr[]

interface ParsedPin {
  number: string
  name: string
  x: number
  y: number
  rotation: number
}

type Side = "leftSide" | "topSide" | "rightSide" | "bottomSide"

function isList(node: SExpr): node is SExpr[] {
  return Array.isArray(node)
}

function str(node: SExpr | undefined): string | undefined {
  if (node === undefined || isList(node)) return undefined
  return String(node)
}

function num(node: SExpr | undefined): number | undefined {
  if (node === undefined || isList(node)) return undefined
  const n = Number(node)
  return Number.isFinite(n) ? n : undefined
}

function findChildNode(parent: SExpr[], tag: string): SExpr[] | undefined {
  return parent.find(
    (child): child is SExpr[] => isList(child) && str(child[0]) === tag,
  )
}

function collectAllByTag(node: SExpr, tag: string): SExpr[][] {
  const results: SExpr[][] = []
  if (!isList(node)) return results
  if (str(node[0]) === tag) results.push(node)
  for (const child of node) {
    if (isList(child)) results.push(...collectAllByTag(child, tag))
  }
  return results
}

function extractTopSymbols(root: SExpr): SExpr[] {
  if (!isList(root)) return []
  if (str(root[0]) === "symbol") return [root]
  if (str(root[0]) === "kicad_symbol_lib") {
    return root.filter(
      (child): child is SExpr[] => isList(child) && str(child[0]) === "symbol",
    )
  }
  return root.flatMap((child) =>
    isList(child) ? extractTopSymbols(child) : [],
  )
}

function extractPin(pinNode: SExpr[]): ParsedPin | null {
  const atNode = findChildNode(pinNode, "at")
  const nameNode = findChildNode(pinNode, "name")
  const numberNode = findChildNode(pinNode, "number")

  const pinNumber = str(numberNode?.[1])
  if (!pinNumber) return null

  const rawName = str(nameNode?.[1]) ?? pinNumber

  return {
    number: pinNumber,
    name: rawName === "~" ? pinNumber : rawName,
    x: num(atNode?.[1]) ?? 0,
    y: num(atNode?.[2]) ?? 0,
    rotation: num(atNode?.[3]) ?? 0,
  }
}

function resolvePins(root: SExpr): ParsedPin[] {
  for (const sym of extractTopSymbols(root)) {
    const pinNodes = collectAllByTag(sym, "pin")
    const pins = pinNodes
      .map(extractPin)
      .filter((p): p is ParsedPin => p !== null)
    if (pins.length > 0) return pins
  }
  return collectAllByTag(root, "pin")
    .map(extractPin)
    .filter((p): p is ParsedPin => p !== null)
}

function determineSide(pin: ParsedPin, cx: number, cy: number): Side {
  const dx = pin.x - cx
  const dy = pin.y - cy

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? "leftSide" : "rightSide"
  }
  if (Math.abs(dy) > 0) {
    return dy < 0 ? "topSide" : "bottomSide"
  }

  const normalized = ((pin.rotation % 360) + 360) % 360
  if (normalized === 0) return "leftSide"
  if (normalized === 180) return "rightSide"
  if (normalized === 90) return "bottomSide"
  return "topSide"
}

const SIDE_DIRECTIONS: Record<Side, SchPinArrangementSide["direction"]> = {
  leftSide: "top-to-bottom",
  rightSide: "bottom-to-top",
  topSide: "left-to-right",
  bottomSide: "right-to-left",
}

function toSnakeCase(
  side: Side,
): "left_side" | "top_side" | "right_side" | "bottom_side" {
  return side.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`) as
    | "left_side"
    | "top_side"
    | "right_side"
    | "bottom_side"
}

export function parseKicadSymToSchematicMetadata(
  kicadSymContent: string,
): KicadSymbolSchematicMetadata | null {
  const root = SParse(kicadSymContent) as SExpr
  const pins = resolvePins(root)
  if (pins.length === 0) return null

  const cx = pins.reduce((s, p) => s + p.x, 0) / pins.length
  const cy = pins.reduce((s, p) => s + p.y, 0) / pins.length

  const grouped: Record<Side, ParsedPin[]> = {
    leftSide: [],
    topSide: [],
    rightSide: [],
    bottomSide: [],
  }
  for (const pin of pins) {
    grouped[determineSide(pin, cx, cy)].push(pin)
  }

  const schPinArrangement: SchPinArrangement = {}
  for (const [side, sidePins] of Object.entries(grouped) as [
    Side,
    ParsedPin[],
  ][]) {
    if (sidePins.length === 0) continue
    const vertical = side === "leftSide" || side === "rightSide"
    const sorted = [...sidePins].sort((a, b) =>
      vertical ? a.y - b.y : a.x - b.x,
    )
    schPinArrangement[side] = {
      pins: sorted.map((p) => `pin${p.number}`),
      direction: SIDE_DIRECTIONS[side],
    }
  }

  const circuitJsonPortArrangement = Object.fromEntries(
    Object.entries(schPinArrangement).map(([side, arr]) => [
      toSnakeCase(side as Side),
      arr,
    ]),
  ) as CircuitJsonPortArrangement

  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    pinLabels[`pin${pin.number}`] = pin.name
  }

  return {
    pinLabels,
    schPinArrangement,
    circuitJsonPortArrangement,
  }
}

export function applyKicadSymMetadataToCircuitJson(
  circuitJson: any[],
  metadata: KicadSymbolSchematicMetadata | null,
): any[] {
  if (!metadata) return circuitJson

  const labelsByNumber: Record<string, string> = {}
  for (const [pinKey, label] of Object.entries(metadata.pinLabels)) {
    labelsByNumber[pinKey.replace(/^pin/, "")] = label
  }

  const portLabelById = new Map<string, string>()

  for (const el of circuitJson) {
    if (el?.type !== "source_port") continue
    const pinNum = el.pin_number?.toString?.() ?? el.name?.toString?.()
    const label = pinNum ? labelsByNumber[pinNum] : undefined
    if (!label) continue
    portLabelById.set(el.source_port_id, label)
    el.pin_label = label
  }

  for (const el of circuitJson) {
    if (el?.type === "schematic_component") {
      el.port_labels = {
        ...(el.port_labels ?? {}),
        ...metadata.pinLabels,
      }
      el.port_arrangement = {
        ...(el.port_arrangement ?? {}),
        ...metadata.circuitJsonPortArrangement,
      }
    }

    if (el?.type === "schematic_port") {
      const label = portLabelById.get(el.source_port_id)
      if (label) el.display_pin_label = label
    }
  }

  return circuitJson
}
