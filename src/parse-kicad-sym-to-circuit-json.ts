import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type SExprRow = Array<any>

export interface KicadSymbolPin {
  name: string
  number: string
  pinKey: string
  at: [number, number, number]
  length?: number
  side: "left" | "right" | "top" | "bottom"
  numericPinNumber?: number
}

export interface KicadSymbolMetadata {
  pins: KicadSymbolPin[]
  portArrangement: Record<string, any>
  portLabels: Record<string, string>
}

const valueOf = (value: any) => value?.valueOf?.() ?? value

const rowKey = (row: SExprRow) => `${valueOf(row[0])}`

const findChild = (row: SExprRow, key: string) =>
  row.find((child) => Array.isArray(child) && rowKey(child) === key)

const parseNumber = (value: any) => {
  const parsed = Number.parseFloat(`${valueOf(value)}`)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseAt = (row: SExprRow): [number, number, number] | undefined => {
  const at = findChild(row, "at")
  if (!at) return undefined
  const x = parseNumber(at[1])
  const y = parseNumber(at[2])
  const rotation = parseNumber(at[3]) ?? 0
  if (x === undefined || y === undefined) return undefined
  return [x, y, rotation]
}

const parseLength = (row: SExprRow) => {
  const length = findChild(row, "length")
  if (!length) return undefined
  return parseNumber(length[1])
}

const parseTextChild = (row: SExprRow, key: string) => {
  const child = findChild(row, key)
  if (!child || child[1] === undefined) return undefined
  return `${valueOf(child[1])}`
}

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360
  return Math.round(normalized)
}

const sideFromRotation = (
  rotation: number,
): KicadSymbolPin["side"] | undefined => {
  switch (normalizeRotation(rotation)) {
    case 0:
      return "left"
    case 90:
      return "bottom"
    case 180:
      return "right"
    case 270:
      return "top"
    default:
      return undefined
  }
}

const sideFromPosition = (
  at: [number, number, number],
  center: { x: number; y: number },
): KicadSymbolPin["side"] => {
  const dx = at[0] - center.x
  const dy = at[1] - center.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx <= 0 ? "left" : "right"
  }
  return dy <= 0 ? "bottom" : "top"
}

const pinKeyFromNumber = (number: string) => {
  const numeric = Number(number)
  return Number.isFinite(numeric) ? `pin${numeric}` : number
}

const collectPinRows = (node: any, rows: SExprRow[] = []) => {
  if (!Array.isArray(node)) return rows
  if (rowKey(node) === "pin") rows.push(node)
  for (const child of node) {
    if (Array.isArray(child)) collectPinRows(child, rows)
  }
  return rows
}

const sortPinsForSide = (
  side: KicadSymbolPin["side"],
  pins: KicadSymbolPin[],
) => {
  return [...pins].sort((a, b) => {
    if (side === "left" || side === "right") {
      return b.at[1] - a.at[1] || a.at[0] - b.at[0]
    }
    return a.at[0] - b.at[0] || b.at[1] - a.at[1]
  })
}

const buildPortArrangement = (pins: KicadSymbolPin[]) => {
  const arrangement: Record<string, any> = {}
  const sideConfig = {
    left: { key: "left_side", direction: "top-to-bottom" },
    right: { key: "right_side", direction: "top-to-bottom" },
    top: { key: "top_side", direction: "left-to-right" },
    bottom: { key: "bottom_side", direction: "left-to-right" },
  } as const

  for (const [side, config] of Object.entries(sideConfig)) {
    const sidePins = sortPinsForSide(
      side as KicadSymbolPin["side"],
      pins.filter(
        (pin) => pin.side === side && typeof pin.numericPinNumber === "number",
      ),
    ).map((pin) => pin.numericPinNumber)

    if (sidePins.length > 0) {
      arrangement[config.key] = {
        pins: sidePins,
        direction: config.direction,
      }
    }
  }

  return arrangement
}

export const parseKicadSymToMetadata = (
  kicadSym: string,
): KicadSymbolMetadata => {
  const kicadSExpr = parseSExpression(kicadSym)
  const pinRows = collectPinRows(kicadSExpr)

  const pinDrafts = pinRows
    .map((row) => {
      const at = parseAt(row)
      const name = parseTextChild(row, "name")
      const number = parseTextChild(row, "number")
      if (!at || !number) return undefined
      return {
        name: name ?? number,
        number,
        at,
        length: parseLength(row),
      }
    })
    .filter(Boolean) as Array<{
    name: string
    number: string
    at: [number, number, number]
    length?: number
  }>

  const center =
    pinDrafts.length > 0
      ? {
          x:
            pinDrafts.reduce((sum, pin) => sum + pin.at[0], 0) /
            pinDrafts.length,
          y:
            pinDrafts.reduce((sum, pin) => sum + pin.at[1], 0) /
            pinDrafts.length,
        }
      : { x: 0, y: 0 }

  const pins = pinDrafts.map((pin): KicadSymbolPin => {
    const numericPinNumber = Number(pin.number)
    return {
      ...pin,
      pinKey: pinKeyFromNumber(pin.number),
      numericPinNumber: Number.isFinite(numericPinNumber)
        ? numericPinNumber
        : undefined,
      side: sideFromRotation(pin.at[2]) ?? sideFromPosition(pin.at, center),
    }
  })

  const portLabels = Object.fromEntries(
    pins
      .filter((pin) => pin.name && pin.name !== "~")
      .map((pin) => [pin.pinKey, pin.name]),
  )

  return {
    pins,
    portArrangement: buildPortArrangement(pins),
    portLabels,
  }
}

const getBoundsSize = (pins: KicadSymbolPin[]) => {
  if (pins.length === 0) return { width: 0, height: 0 }
  const xs = pins.map((pin) => pin.at[0])
  const ys = pins.map((pin) => pin.at[1])
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

const unique = (items: Array<string | undefined>) => [
  ...new Set(items.filter(Boolean) as string[]),
]

const buildPortLabels = (pins: KicadSymbolPin[]) =>
  Object.fromEntries(
    pins
      .filter((pin) => pin.name && pin.name !== "~")
      .map((pin) => [pin.pinKey, pin.name]),
  )

const findPinForElement = (
  element: any,
  pinsByNumber: Map<string, KicadSymbolPin>,
) => {
  const candidates = unique([
    element.pin_number !== undefined ? `${element.pin_number}` : undefined,
    element.name,
    element.pin_label?.startsWith?.("pin")
      ? element.pin_label.slice(3)
      : undefined,
    ...(Array.isArray(element.port_hints) ? element.port_hints : []),
  ])

  for (const candidate of candidates) {
    const normalized = candidate.startsWith("pin")
      ? candidate.slice(3)
      : candidate
    const pin = pinsByNumber.get(normalized)
    if (pin) return pin
  }
}

export const applyKicadSymMetadataToCircuitJson = (
  circuitJson: AnyCircuitElement[],
  metadata: KicadSymbolMetadata,
): AnyCircuitElement[] => {
  const pinsByNumber = new Map(metadata.pins.map((pin) => [pin.number, pin]))
  const matchingPins = [
    ...new Map(
      circuitJson
        .filter((element: any) => element.type === "source_port")
        .map((element) => findPinForElement(element, pinsByNumber))
        .filter(Boolean)
        .map((pin) => [pin!.number, pin!]),
    ).values(),
  ]
  const portArrangement = buildPortArrangement(matchingPins)
  const portLabels = buildPortLabels(matchingPins)

  return circuitJson.map((element: any) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        port_arrangement:
          Object.keys(portArrangement).length > 0
            ? portArrangement
            : element.port_arrangement,
        port_labels:
          Object.keys(portLabels).length > 0
            ? { ...(element.port_labels ?? {}), ...portLabels }
            : element.port_labels,
      }
    }

    if (
      element.type === "source_port" ||
      element.type === "pcb_port" ||
      element.type === "pcb_smtpad" ||
      element.type === "pcb_plated_hole"
    ) {
      const pin = findPinForElement(element, pinsByNumber)
      if (!pin) return element

      return {
        ...element,
        pin_number: pin.numericPinNumber ?? element.pin_number,
        pin_label: pin.pinKey,
        port_hints: unique([
          ...(Array.isArray(element.port_hints) ? element.port_hints : []),
          pin.pinKey,
          pin.number,
          pin.name,
        ]),
      }
    }

    return element
  }) as AnyCircuitElement[]
}

export const parseKicadSymToCircuitJson = (
  kicadSym: string,
): AnyCircuitElement[] => {
  const metadata = parseKicadSymToMetadata(kicadSym)
  const size = getBoundsSize(metadata.pins)
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_0",
      supplier_part_numbers: {},
    } as any,
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_0",
      source_component_id: "source_component_0",
      center: { x: 0, y: 0 },
      rotation: 0,
      size,
      port_arrangement: metadata.portArrangement,
      port_labels: metadata.portLabels,
    } as any,
  ]

  for (const [index, pin] of metadata.pins.entries()) {
    const sourcePortId = `source_port_${index}`
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: pin.number,
      port_hints: unique([pin.pinKey, pin.number, pin.name]),
      pin_number: pin.numericPinNumber,
      pin_label: pin.pinKey,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index}`,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
    } as any)
  }

  return circuitJson
}
