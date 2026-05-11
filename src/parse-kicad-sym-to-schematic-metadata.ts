import SParseModule from "s-expression"

const SParse = (SParseModule as any).default ?? SParseModule

export type SchPortArrangementSide = {
  pins: Array<string | number>
  direction:
    | "top-to-bottom"
    | "left-to-right"
    | "bottom-to-top"
    | "right-to-left"
}

export type SchPortArrangement = {
  leftSide?: SchPortArrangementSide
  topSide?: SchPortArrangementSide
  rightSide?: SchPortArrangementSide
  bottomSide?: SchPortArrangementSide
}

export type CircuitJsonPortArrangement = {
  left_side?: SchPortArrangementSide
  top_side?: SchPortArrangementSide
  right_side?: SchPortArrangementSide
  bottom_side?: SchPortArrangementSide
}

export type KicadSymbolSchematicMetadata = {
  pinLabels: Record<string, string>
  schPortArrangement: SchPortArrangement
  circuitJsonPortArrangement: CircuitJsonPortArrangement
}

type SExpr = string | number | String | Number | SExpr[]

type KicadSymbolPin = {
  pinNumber: string
  pinKey: string
  label: string
  x: number
  y: number
  rotation: number
}

const isList = (node: SExpr): node is SExpr[] => Array.isArray(node)

const nodeName = (value: SExpr | undefined): string | undefined => {
  if (value === undefined) return undefined
  if (isList(value)) return undefined
  return String(value)
}

const asString = (value: SExpr | undefined): string | undefined => {
  if (value === undefined || isList(value)) return undefined
  return String(value)
}

const asNumber = (value: SExpr | undefined): number | undefined => {
  if (value === undefined || isList(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const findChild = (node: SExpr[], name: string): SExpr[] | undefined =>
  node.find(
    (child): child is SExpr[] => isList(child) && nodeName(child[0]) === name,
  )

const collectNodes = (
  node: SExpr,
  name: string,
  out: SExpr[][] = [],
): SExpr[][] => {
  if (!isList(node)) return out
  if (nodeName(node[0]) === name) out.push(node)
  for (const child of node) collectNodes(child, name, out)
  return out
}

const getTopLevelSymbolNodes = (root: SExpr): SExpr[] => {
  if (!isList(root)) return []
  if (nodeName(root[0]) === "symbol") return [root]
  if (nodeName(root[0]) === "kicad_symbol_lib") {
    return root.filter(
      (child): child is SExpr[] =>
        isList(child) && nodeName(child[0]) === "symbol",
    )
  }
  return root.flatMap((child) => getTopLevelSymbolNodes(child))
}

const parsePin = (pinNode: SExpr[]): KicadSymbolPin | null => {
  const atNode = findChild(pinNode, "at")
  const nameNode = findChild(pinNode, "name")
  const numberNode = findChild(pinNode, "number")
  const pinNumber = asString(numberNode?.[1])
  if (!pinNumber) return null

  const label = asString(nameNode?.[1]) ?? pinNumber
  const x = asNumber(atNode?.[1]) ?? 0
  const y = asNumber(atNode?.[2]) ?? 0
  const rotation = asNumber(atNode?.[3]) ?? 0

  return {
    pinNumber,
    pinKey: `pin${pinNumber}`,
    label: label === "~" ? pinNumber : label,
    x,
    y,
    rotation,
  }
}

const chooseSymbolPins = (root: SExpr): KicadSymbolPin[] => {
  const symbolNodes = getTopLevelSymbolNodes(root)
  for (const symbolNode of symbolNodes) {
    const rawPins = collectNodes(symbolNode, "pin")
    const pins = rawPins
      .map(parsePin)
      .filter((pin): pin is KicadSymbolPin => pin !== null)
    if (pins.length > 0) return pins
  }

  const rawPins = collectNodes(root, "pin")
  return rawPins
    .map(parsePin)
    .filter((pin): pin is KicadSymbolPin => pin !== null)
}

type SideName = "leftSide" | "topSide" | "rightSide" | "bottomSide"

const sideForPin = (
  pin: KicadSymbolPin,
  centerX: number,
  centerY: number,
): SideName => {
  const dx = pin.x - centerX
  const dy = pin.y - centerY

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? "leftSide" : "rightSide"
  }
  if (Math.abs(dy) > 0) {
    return dy < 0 ? "topSide" : "bottomSide"
  }

  const normalizedRotation = ((pin.rotation % 360) + 360) % 360
  if (normalizedRotation === 0) return "leftSide"
  if (normalizedRotation === 180) return "rightSide"
  if (normalizedRotation === 90) return "bottomSide"
  return "topSide"
}

const directionForSide: Record<SideName, SchPortArrangementSide["direction"]> =
  {
    leftSide: "top-to-bottom",
    rightSide: "bottom-to-top",
    topSide: "left-to-right",
    bottomSide: "right-to-left",
  }

const snakeCaseSide = (side: SideName) =>
  side.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`) as
    | "left_side"
    | "top_side"
    | "right_side"
    | "bottom_side"

export const parseKicadSymToSchematicMetadata = (
  kicadSymContent: string,
): KicadSymbolSchematicMetadata | null => {
  const root = SParse(kicadSymContent) as SExpr
  const pins = chooseSymbolPins(root)
  if (pins.length === 0) return null

  const centerX = pins.reduce((sum, pin) => sum + pin.x, 0) / pins.length
  const centerY = pins.reduce((sum, pin) => sum + pin.y, 0) / pins.length
  const pinsBySide: Record<SideName, KicadSymbolPin[]> = {
    leftSide: [],
    topSide: [],
    rightSide: [],
    bottomSide: [],
  }

  for (const pin of pins) {
    pinsBySide[sideForPin(pin, centerX, centerY)].push(pin)
  }

  const schPortArrangement: SchPortArrangement = {}
  for (const [side, sidePins] of Object.entries(pinsBySide) as Array<
    [SideName, KicadSymbolPin[]]
  >) {
    if (sidePins.length === 0) continue
    const isVerticalSide = side === "leftSide" || side === "rightSide"
    const sortedPins = [...sidePins].sort((a, b) =>
      isVerticalSide ? a.y - b.y : a.x - b.x,
    )
    schPortArrangement[side] = {
      pins: sortedPins.map((pin) => pin.label),
      direction: directionForSide[side],
    }
  }

  const circuitJsonPortArrangement = Object.fromEntries(
    Object.entries(schPortArrangement).map(([side, arrangement]) => [
      snakeCaseSide(side as SideName),
      arrangement,
    ]),
  ) as CircuitJsonPortArrangement

  return {
    pinLabels: Object.fromEntries(
      pins.map((pin) => [pin.pinKey, pin.label] as const),
    ),
    schPortArrangement,
    circuitJsonPortArrangement,
  }
}

export const applyKicadSymMetadataToCircuitJson = (
  circuitJson: any[],
  metadata: KicadSymbolSchematicMetadata | null,
): any[] => {
  if (!metadata) return circuitJson

  const pinLabelsByNumber = Object.fromEntries(
    Object.entries(metadata.pinLabels).map(([pinKey, label]) => [
      pinKey.replace(/^pin/, ""),
      label,
    ]),
  )
  const sourcePortLabelById = new Map<string, string>()

  for (const element of circuitJson) {
    if (element?.type !== "source_port") continue
    const pinNumber =
      element.pin_number?.toString?.() ?? element.name?.toString?.()
    const label = pinNumber ? pinLabelsByNumber[pinNumber] : undefined
    if (!label) continue
    sourcePortLabelById.set(element.source_port_id, label)
    element.pin_label = `pin${pinNumber}`
  }

  for (const element of circuitJson) {
    if (element?.type === "schematic_component") {
      element.port_labels = {
        ...(element.port_labels ?? {}),
        ...metadata.pinLabels,
      }
      element.port_arrangement = {
        ...(element.port_arrangement ?? {}),
        ...metadata.circuitJsonPortArrangement,
      }
    }

    if (element?.type === "schematic_port") {
      const label = sourcePortLabelById.get(element.source_port_id)
      if (label) element.display_pin_label = label
    }
  }

  return circuitJson
}
