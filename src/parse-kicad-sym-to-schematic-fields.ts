import parseSExpression from "s-expression"
import type { AnyCircuitElement } from "circuit-json"

type SExpr = any[]

type KicadSymbolPin = {
  number: string
  name: string
  at: [number, number, number?]
}

type PortSide = "left_side" | "right_side" | "top_side" | "bottom_side"

export type KicadSymSchematicFields = {
  port_arrangement?: {
    left_side?: { pins: number[]; direction: "top-to-bottom" }
    right_side?: { pins: number[]; direction: "top-to-bottom" }
    top_side?: { pins: number[]; direction: "left-to-right" }
    bottom_side?: { pins: number[]; direction: "left-to-right" }
  }
  port_labels?: Record<string, string>
}

const valueOf = (value: any) => value?.valueOf?.() ?? value

const isRow = (value: any): value is SExpr =>
  Array.isArray(value) && typeof valueOf(value[0]) === "string"

const getChildRows = (row: SExpr, tag: string) =>
  row.filter((child) => isRow(child) && valueOf(child[0]) === tag)

const getAttr = (row: SExpr, tag: string) => getChildRows(row, tag)[0]

const collectRows = (row: any, tag: string, result: SExpr[] = []) => {
  if (!isRow(row)) return result
  if (valueOf(row[0]) === tag) result.push(row)
  for (const child of row) {
    if (isRow(child)) collectRows(child, tag, result)
  }
  return result
}

const parseAt = (row: SExpr): [number, number, number?] | undefined => {
  const at = getAttr(row, "at")
  if (!at) return undefined
  const x = Number(valueOf(at[1]))
  const y = Number(valueOf(at[2]))
  const rotation = at[3] === undefined ? undefined : Number(valueOf(at[3]))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return Number.isFinite(rotation) ? [x, y, rotation] : [x, y]
}

const parsePin = (row: SExpr): KicadSymbolPin | undefined => {
  const at = parseAt(row)
  const name = valueOf(getAttr(row, "name")?.[1]) ?? ""
  const number = valueOf(getAttr(row, "number")?.[1]) ?? ""
  if (!at || !number) return undefined
  return {
    at,
    name: `${name}`,
    number: `${number}`,
  }
}

const getPinSide = (pin: KicadSymbolPin): PortSide => {
  const [x, y, rotation = Number.NaN] = pin.at
  const normalizedRotation = ((rotation % 360) + 360) % 360

  if (normalizedRotation === 0) return "left_side"
  if (normalizedRotation === 180) return "right_side"
  if (normalizedRotation === 90) return "bottom_side"
  if (normalizedRotation === 270) return "top_side"

  if (Math.abs(x) >= Math.abs(y)) {
    return x < 0 ? "left_side" : "right_side"
  }
  return y >= 0 ? "top_side" : "bottom_side"
}

const comparePinsForSide = (side: PortSide) => {
  if (side === "left_side" || side === "right_side") {
    return (a: KicadSymbolPin, b: KicadSymbolPin) => b.at[1] - a.at[1]
  }
  return (a: KicadSymbolPin, b: KicadSymbolPin) => a.at[0] - b.at[0]
}

const parsePinNumber = (pin: KicadSymbolPin) => {
  const parsed = Number(pin.number)
  return Number.isInteger(parsed) ? parsed : undefined
}

export const parseKicadSymToSchematicFields = (
  kicadSym: string,
): KicadSymSchematicFields => {
  const parsed = parseSExpression(kicadSym)
  const pins = collectRows(parsed, "pin")
    .map(parsePin)
    .filter(Boolean) as KicadSymbolPin[]

  const pinsBySide: Record<PortSide, KicadSymbolPin[]> = {
    left_side: [],
    right_side: [],
    top_side: [],
    bottom_side: [],
  }
  const portLabels: Record<string, string> = {}

  for (const pin of pins) {
    pinsBySide[getPinSide(pin)].push(pin)
    if (pin.name && pin.name !== "~") {
      portLabels[pin.number] = pin.name
    }
  }

  const portArrangement: KicadSymSchematicFields["port_arrangement"] = {}

  for (const side of Object.keys(pinsBySide) as PortSide[]) {
    const numericPins = pinsBySide[side]
      .sort(comparePinsForSide(side))
      .map(parsePinNumber)
      .filter((pinNumber): pinNumber is number => pinNumber !== undefined)

    if (numericPins.length === 0) continue

    if (side === "left_side" || side === "right_side") {
      portArrangement[side] = {
        pins: numericPins,
        direction: "top-to-bottom",
      }
    } else {
      portArrangement[side] = {
        pins: numericPins,
        direction: "left-to-right",
      }
    }
  }

  return {
    port_arrangement:
      Object.keys(portArrangement).length > 0 ? portArrangement : undefined,
    port_labels: Object.keys(portLabels).length > 0 ? portLabels : undefined,
  }
}

export const applyKicadSymToCircuitJson = (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): AnyCircuitElement[] => {
  const fields = parseKicadSymToSchematicFields(kicadSym)

  return circuitJson.map((element: any) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        ...fields,
      }
    }

    if (element.type === "source_port" && fields.port_labels) {
      const pinKey =
        element.pin_number !== undefined
          ? `${element.pin_number}`
          : element.name
      const pinLabel = fields.port_labels[pinKey]
      if (!pinLabel) return element
      return {
        ...element,
        pin_label: pinLabel,
        port_hints: [...new Set([...(element.port_hints ?? []), pinLabel])],
      }
    }

    return element
  })
}

export const parseKicadSymToCircuitJson = (
  kicadSym: string,
): AnyCircuitElement[] => {
  const fields = parseKicadSymToSchematicFields(kicadSym)
  const pinNumbers = [
    ...new Set(
      [
        ...Object.values(fields.port_arrangement ?? {}).flatMap(
          (side: any) => side.pins,
        ),
        ...Object.keys(fields.port_labels ?? {}).map((pin) => Number(pin)),
      ].filter((pinNumber) => Number.isFinite(pinNumber)),
    ),
  ].sort((a, b) => a - b)

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
      size: { width: 0, height: 0 },
      ...fields,
    } as any,
  ]

  for (const pinNumber of pinNumbers) {
    const sourcePortId = `source_port_${pinNumber}`
    const pinLabel = fields.port_labels?.[`${pinNumber}`]
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: `${pinNumber}`,
      port_hints: pinLabel ? [`${pinNumber}`, pinLabel] : [`${pinNumber}`],
      pin_number: pinNumber,
      pin_label: pinLabel,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${pinNumber}`,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
    } as any)
  }

  return circuitJson
}
