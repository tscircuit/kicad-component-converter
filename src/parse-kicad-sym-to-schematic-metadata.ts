import parseSExpression from "s-expression"

type SExprNode = unknown[] & { 0?: unknown }

export type SchematicArrangementPin = number | string

export interface ParsedKicadSymbolPin {
  name: string
  number: string
  x: number
  y: number
  rotation: number
  side: "left" | "right" | "top" | "bottom"
  arrangementPin: SchematicArrangementPin
}

export interface KicadSymbolSchematicMetadata {
  pins: ParsedKicadSymbolPin[]
  pinLabels: Record<string, string>
  portArrangement: {
    left_side?: {
      pins: SchematicArrangementPin[]
      direction: "top-to-bottom" | "bottom-to-top"
    }
    right_side?: {
      pins: SchematicArrangementPin[]
      direction: "top-to-bottom" | "bottom-to-top"
    }
    top_side?: {
      pins: SchematicArrangementPin[]
      direction: "left-to-right" | "right-to-left"
    }
    bottom_side?: {
      pins: SchematicArrangementPin[]
      direction: "left-to-right" | "right-to-left"
    }
  }
  size: { width: number; height: number }
  pinSpacing: number
  portPositions: Record<
    string,
    {
      center: { x: number; y: number }
      facingDirection: "up" | "down" | "left" | "right"
      sideOfComponent: "top" | "bottom" | "left" | "right"
      displayPinLabel?: string
    }
  >
}

const PIN_SPACING = 0.2
const PORT_DISTANCE_FROM_EDGE = 0.4

const isNode = (value: unknown): value is SExprNode => Array.isArray(value)

const atomToString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  const raw = (value as any)?.valueOf?.() ?? value
  if (raw === undefined || raw === null) return undefined
  return `${raw}`
}

const atomToNumber = (value: unknown): number | undefined => {
  const text = atomToString(value)
  if (!text) return undefined
  const parsed = Number.parseFloat(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

const nodeName = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined
  return atomToString(node[0])
}

const findChildNode = (node: SExprNode, key: string): SExprNode | undefined =>
  node.find((child) => isNode(child) && nodeName(child) === key) as
    | SExprNode
    | undefined

const findDirectChildSymbols = (node: SExprNode) =>
  node.filter((child) => nodeName(child) === "symbol") as SExprNode[]

const findAllNodesByName = (node: unknown, key: string): SExprNode[] => {
  if (!isNode(node)) return []

  const matches: SExprNode[] = []
  if (nodeName(node) === key) {
    matches.push(node)
  }

  for (const child of node) {
    if (isNode(child)) {
      matches.push(...findAllNodesByName(child, key))
    }
  }

  return matches
}

const getSymbolCandidates = (root: SExprNode) => {
  if (nodeName(root) === "symbol") return [root]

  const directSymbols = findDirectChildSymbols(root)
  if (directSymbols.length > 0) return directSymbols

  return findAllNodesByName(root, "symbol")
}

const hasPins = (node: SExprNode) => findAllNodesByName(node, "pin").length > 0

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360
  const nearestRightAngle = Math.round(normalized / 90) * 90
  if (Math.abs(normalized - nearestRightAngle) < 0.0001) {
    return nearestRightAngle % 360
  }
  return normalized
}

const getSideFromRotation = (
  rotation: number,
): ParsedKicadSymbolPin["side"] | undefined => {
  switch (normalizeRotation(rotation)) {
    case 0:
      return "left"
    case 180:
      return "right"
    case 90:
      return "bottom"
    case 270:
      return "top"
  }
}

const getArrangementPin = (pinNumber: string): SchematicArrangementPin => {
  const asNumber = Number(pinNumber)
  return Number.isFinite(asNumber) && `${asNumber}` === pinNumber
    ? asNumber
    : pinNumber
}

const parsePinNode = (
  pinNode: SExprNode,
): Omit<ParsedKicadSymbolPin, "side"> | null => {
  const at = findChildNode(pinNode, "at")
  const name = findChildNode(pinNode, "name")
  const number = findChildNode(pinNode, "number")
  const x = atomToNumber(at?.[1])
  const y = atomToNumber(at?.[2])
  const rotation = atomToNumber(at?.[3]) ?? 0
  const pinNumber = atomToString(number?.[1])

  if (!pinNumber || x === undefined || y === undefined) {
    return null
  }

  return {
    name: atomToString(name?.[1]) ?? "",
    number: pinNumber,
    x,
    y,
    rotation,
    arrangementPin: getArrangementPin(pinNumber),
  }
}

const getFallbackSide = (
  pin: Omit<ParsedKicadSymbolPin, "side">,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): ParsedKicadSymbolPin["side"] => {
  const distances = [
    { side: "left" as const, distance: Math.abs(pin.x - bounds.minX) },
    { side: "right" as const, distance: Math.abs(pin.x - bounds.maxX) },
    { side: "bottom" as const, distance: Math.abs(pin.y - bounds.minY) },
    { side: "top" as const, distance: Math.abs(pin.y - bounds.maxY) },
  ]

  return distances.sort((a, b) => a.distance - b.distance)[0].side
}

const compareArrangementPins = (
  a: SchematicArrangementPin,
  b: SchematicArrangementPin,
) => {
  if (typeof a === "number" && typeof b === "number") return a - b
  return `${a}`.localeCompare(`${b}`, undefined, { numeric: true })
}

const sortPinsForSide = (
  pins: ParsedKicadSymbolPin[],
  side: ParsedKicadSymbolPin["side"],
) =>
  [...pins].sort((a, b) => {
    if (side === "left" || side === "right") {
      const yDiff = b.y - a.y
      if (yDiff !== 0) return yDiff
    } else {
      const xDiff = a.x - b.x
      if (xDiff !== 0) return xDiff
    }

    return compareArrangementPins(a.arrangementPin, b.arrangementPin)
  })

const isVisiblePinLabel = (label: string) => label.length > 0 && label !== "~"

const buildPortArrangement = (pins: ParsedKicadSymbolPin[]) => {
  const bySide = {
    left: sortPinsForSide(
      pins.filter((pin) => pin.side === "left"),
      "left",
    ),
    right: sortPinsForSide(
      pins.filter((pin) => pin.side === "right"),
      "right",
    ),
    top: sortPinsForSide(
      pins.filter((pin) => pin.side === "top"),
      "top",
    ),
    bottom: sortPinsForSide(
      pins.filter((pin) => pin.side === "bottom"),
      "bottom",
    ),
  }

  const portArrangement: KicadSymbolSchematicMetadata["portArrangement"] = {}
  if (bySide.left.length > 0) {
    portArrangement.left_side = {
      pins: bySide.left.map((pin) => pin.arrangementPin),
      direction: "top-to-bottom",
    }
  }
  if (bySide.right.length > 0) {
    portArrangement.right_side = {
      pins: bySide.right.map((pin) => pin.arrangementPin),
      direction: "top-to-bottom",
    }
  }
  if (bySide.top.length > 0) {
    portArrangement.top_side = {
      pins: bySide.top.map((pin) => pin.arrangementPin),
      direction: "left-to-right",
    }
  }
  if (bySide.bottom.length > 0) {
    portArrangement.bottom_side = {
      pins: bySide.bottom.map((pin) => pin.arrangementPin),
      direction: "left-to-right",
    }
  }

  return { bySide, portArrangement }
}

const buildSize = (
  bySide: Record<ParsedKicadSymbolPin["side"], ParsedKicadSymbolPin[]>,
) => {
  const verticalPinCount = Math.max(bySide.left.length, bySide.right.length)
  const horizontalPinCount = Math.max(bySide.top.length, bySide.bottom.length)

  return {
    width: Math.max(0.4, (horizontalPinCount + 1) * PIN_SPACING),
    height: Math.max(0.4, (verticalPinCount + 1) * PIN_SPACING),
  }
}

const buildPortPositions = (
  bySide: Record<ParsedKicadSymbolPin["side"], ParsedKicadSymbolPin[]>,
  size: { width: number; height: number },
) => {
  const portPositions: KicadSymbolSchematicMetadata["portPositions"] = {}
  const xBySide = {
    left: -size.width / 2 - PORT_DISTANCE_FROM_EDGE,
    right: size.width / 2 + PORT_DISTANCE_FROM_EDGE,
    top: 0,
    bottom: 0,
  }
  const yBySide = {
    left: 0,
    right: 0,
    top: size.height / 2 + PORT_DISTANCE_FROM_EDGE,
    bottom: -size.height / 2 - PORT_DISTANCE_FROM_EDGE,
  }
  const facingDirectionBySide = {
    left: "left" as const,
    right: "right" as const,
    top: "up" as const,
    bottom: "down" as const,
  }

  for (const [side, pins] of Object.entries(bySide) as Array<
    [ParsedKicadSymbolPin["side"], ParsedKicadSymbolPin[]]
  >) {
    pins.forEach((pin, index) => {
      const center =
        side === "left" || side === "right"
          ? {
              x: xBySide[side],
              y: ((pins.length - 1) / 2 - index) * PIN_SPACING,
            }
          : {
              x: (index - (pins.length - 1) / 2) * PIN_SPACING,
              y: yBySide[side],
            }

      portPositions[pin.number] = {
        center,
        facingDirection: facingDirectionBySide[side],
        sideOfComponent: side,
        displayPinLabel: isVisiblePinLabel(pin.name) ? pin.name : undefined,
      }
    })
  }

  return portPositions
}

export const parseKicadSymToSchematicMetadata = (
  kicadSym: string,
): KicadSymbolSchematicMetadata | undefined => {
  const root = parseSExpression(kicadSym) as SExprNode
  const symbolNode = getSymbolCandidates(root).find(hasPins)
  if (!symbolNode) return undefined

  const parsedPins = findAllNodesByName(symbolNode, "pin")
    .map(parsePinNode)
    .filter((pin): pin is Omit<ParsedKicadSymbolPin, "side"> => pin !== null)

  if (parsedPins.length === 0) return undefined

  const bounds = {
    minX: Math.min(...parsedPins.map((pin) => pin.x)),
    maxX: Math.max(...parsedPins.map((pin) => pin.x)),
    minY: Math.min(...parsedPins.map((pin) => pin.y)),
    maxY: Math.max(...parsedPins.map((pin) => pin.y)),
  }

  const pinsByNumber = new Map<string, ParsedKicadSymbolPin>()
  for (const pin of parsedPins) {
    if (pinsByNumber.has(pin.number)) continue
    pinsByNumber.set(pin.number, {
      ...pin,
      side: getSideFromRotation(pin.rotation) ?? getFallbackSide(pin, bounds),
    })
  }

  const pins = [...pinsByNumber.values()]
  const { bySide, portArrangement } = buildPortArrangement(pins)
  const size = buildSize(bySide)
  const portPositions = buildPortPositions(bySide, size)
  const pinLabels: Record<string, string> = {}

  for (const pin of pins) {
    if (isVisiblePinLabel(pin.name)) {
      pinLabels[pin.number] = pin.name
    }
  }

  return {
    pins,
    pinLabels,
    portArrangement,
    size,
    pinSpacing: PIN_SPACING,
    portPositions,
  }
}
