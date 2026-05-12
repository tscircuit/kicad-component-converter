import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type SExpr = unknown[]

interface KicadSymbolPin {
  name: string
  number: string
  side: "leftSide" | "rightSide" | "topSide" | "bottomSide"
}

const asText = (value: unknown) =>
  value === undefined || value === null ? "" : String((value as any).valueOf())

const isNode = (value: unknown, tag?: string): value is SExpr =>
  Array.isArray(value) && (tag === undefined || asText(value[0]) === tag)

const findNodes = (root: unknown, tag: string): SExpr[] => {
  if (!Array.isArray(root)) return []
  const matches: SExpr[] = []
  if (isNode(root, tag)) matches.push(root)
  for (const child of root) {
    matches.push(...findNodes(child, tag))
  }
  return matches
}

const getChild = (node: SExpr, tag: string) =>
  node.find((child) => isNode(child, tag)) as SExpr | undefined

const getAttributeText = (node: SExpr, tag: string) => {
  const child = getChild(node, tag)
  return child ? asText(child[1]) : ""
}

const getPinSide = (rotation: number): KicadSymbolPin["side"] => {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 0) return "leftSide"
  if (normalized === 90) return "bottomSide"
  if (normalized === 180) return "rightSide"
  if (normalized === 270) return "topSide"
  return "leftSide"
}

const parsePins = (symbolNode: SExpr): KicadSymbolPin[] =>
  findNodes(symbolNode, "pin").flatMap((pinNode) => {
    const name = getAttributeText(pinNode, "name")
    const number = getAttributeText(pinNode, "number")
    if (!number) return []

    const at = getChild(pinNode, "at")
    const rotation = at ? Number(asText(at[3]) || 0) : 0
    return [{ name, number, side: getPinSide(rotation) }]
  })

const getPrimarySymbol = (root: SExpr) => {
  if (asText(root[0]) === "symbol") return root

  const topLevelSymbols = root.filter((child) =>
    isNode(child, "symbol"),
  ) as SExpr[]
  if (topLevelSymbols.length === 0) return undefined

  return (
    topLevelSymbols.find(
      (symbolNode) => !/_\d+_\d+$/.test(asText(symbolNode[1])),
    ) ?? topLevelSymbols[0]
  )
}

const getSymbolName = (symbolNode: SExpr | undefined) =>
  symbolNode ? asText(symbolNode[1]) || "KicadSymbol" : "KicadSymbol"

const createPinMetadata = (pins: KicadSymbolPin[]) => {
  const schPortArrangement = {
    leftSide: [] as string[],
    rightSide: [] as string[],
    topSide: [] as string[],
    bottomSide: [] as string[],
  }
  const pinLabels: Record<string, string> = {}

  for (const pin of pins) {
    schPortArrangement[pin.side].push(pin.number)
    pinLabels[pin.number] = pin.name || pin.number
  }

  return {
    schPortArrangement: Object.fromEntries(
      Object.entries(schPortArrangement).filter(
        ([, sidePins]) => sidePins.length > 0,
      ),
    ),
    pinLabels,
  }
}

const getSymbolData = (kicadSym: string) => {
  const parsed = parseSExpression(kicadSym) as SExpr
  const primarySymbol = getPrimarySymbol(parsed)
  return {
    symbolName: getSymbolName(primarySymbol),
    pins: primarySymbol ? parsePins(primarySymbol) : [],
  }
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const { symbolName, pins } = getSymbolData(kicadSym)
  const { schPortArrangement, pinLabels } = createPinMetadata(pins)
  const circuitJson: AnyCircuitElement[] = []

  circuitJson.push({
    type: "source_component",
    source_component_id: "source_component_0",
    name: symbolName,
    supplier_part_numbers: {},
  } as any)

  circuitJson.push({
    type: "schematic_component",
    schematic_component_id: "schematic_component_0",
    source_component_id: "source_component_0",
    center: { x: 0, y: 0 },
    rotation: 0,
    size: { width: 0, height: 0 },
    schPortArrangement,
    pinLabels,
  } as any)

  for (const [index, pin] of pins.entries()) {
    const pinNumber = Number(pin.number)
    const sourcePortId = `source_port_${index}`
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: pin.name || pin.number,
      port_hints: [pin.name, `pin${pin.number}`, pin.number].filter(Boolean),
      pin_number: Number.isFinite(pinNumber) ? pinNumber : undefined,
      pin_label: pin.name || pin.number,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index}`,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
      display_pin_label: pin.name || pin.number,
    } as any)
  }

  return circuitJson
}

export const enhanceCircuitJsonWithKicadSym = async (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const { pins } = getSymbolData(kicadSym)
  const { schPortArrangement, pinLabels } = createPinMetadata(pins)

  return circuitJson.map((element) => {
    if (element.type !== "schematic_component") return element
    return { ...element, schPortArrangement, pinLabels } as any
  })
}
