import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

export interface KicadSymSchematicMetadata {
  port_arrangement?: {
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
  port_labels?: Record<string, string>
}

export type KicadSymMetadata = KicadSymSchematicMetadata

type ParsedPin = {
  number: number
  name: string
  x: number
  y: number
  rotation: number
}

const toValue = (value: any) => value?.valueOf?.() ?? value

const findRows = (node: any, rowName: string, rows: any[][] = []) => {
  if (!Array.isArray(node)) return rows
  if (toValue(node[0]) === rowName) rows.push(node)

  for (const child of node) {
    findRows(child, rowName, rows)
  }

  return rows
}

const getChildRow = (row: any[], name: string) =>
  row.find((child) => Array.isArray(child) && toValue(child[0]) === name)

const getStringChild = (row: any[], name: string) => {
  const child = getChildRow(row, name)
  if (!child) return undefined
  const value = toValue(child[1])
  return value === undefined ? undefined : `${value}`
}

const getAt = (row: any[]) => {
  const child = getChildRow(row, "at")
  if (!child) return undefined

  const nums = child
    .slice(1)
    .map((value: any) => Number.parseFloat(`${toValue(value)}`))
    .filter((value: number) => Number.isFinite(value))

  if (nums.length < 2) return undefined

  return {
    x: nums[0]!,
    y: nums[1]!,
    rotation: nums[2] ?? 0,
  }
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360

const cardinalRotation = (rotation: number) => {
  const normalized = normalizeRotation(rotation)
  if (normalized >= 315 || normalized < 45) return 0
  if (normalized >= 45 && normalized < 135) return 90
  if (normalized >= 135 && normalized < 225) return 180
  return 270
}

const pinSideFromRotation = (rotation: number) => {
  switch (cardinalRotation(rotation)) {
    case 0:
      return "left_side"
    case 180:
      return "right_side"
    case 90:
      return "bottom_side"
    case 270:
      return "top_side"
  }
}

const parsePin = (row: any[]): ParsedPin | undefined => {
  const at = getAt(row)
  const numberText = getStringChild(row, "number")
  const name = getStringChild(row, "name") ?? ""

  if (!at || !numberText) return undefined

  const number = Number.parseInt(numberText, 10)
  if (!Number.isFinite(number)) return undefined

  return {
    number,
    name,
    ...at,
  }
}

const getSortedPinsForSide = (
  side: keyof NonNullable<KicadSymSchematicMetadata["port_arrangement"]>,
) => {
  if (side === "left_side" || side === "right_side") {
    return (a: ParsedPin, b: ParsedPin) => b.y - a.y
  }
  return (a: ParsedPin, b: ParsedPin) => a.x - b.x
}

export const parseKicadSymToSchematicMetadata = (
  fileContent: string,
): KicadSymSchematicMetadata => {
  const root = parseSExpression(fileContent)
  const pins = findRows(root, "pin")
    .map(parsePin)
    .filter((pin): pin is ParsedPin => Boolean(pin))

  const pinsBySide: Record<
    "left_side" | "right_side" | "top_side" | "bottom_side",
    ParsedPin[]
  > = {
    left_side: [],
    right_side: [],
    top_side: [],
    bottom_side: [],
  }
  const port_labels: Record<string, string> = {}

  for (const pin of pins) {
    pinsBySide[pinSideFromRotation(pin.rotation)].push(pin)
    if (pin.name && pin.name !== "~") {
      port_labels[String(pin.number)] = pin.name
    }
  }

  const port_arrangement: NonNullable<
    KicadSymSchematicMetadata["port_arrangement"]
  > = {}

  for (const side of Object.keys(pinsBySide) as Array<
    keyof typeof pinsBySide
  >) {
    const sortedPins = pinsBySide[side]
      .slice()
      .sort(getSortedPinsForSide(side))
      .map((pin) => pin.number)

    if (sortedPins.length === 0) continue

    port_arrangement[side] = {
      pins: sortedPins,
      direction:
        side === "left_side" || side === "right_side"
          ? "top-to-bottom"
          : "left-to-right",
    } as any
  }

  return {
    port_arrangement:
      Object.keys(port_arrangement).length > 0 ? port_arrangement : undefined,
    port_labels: Object.keys(port_labels).length > 0 ? port_labels : undefined,
  }
}

export const parseKicadSymToCircuitJson = async (
  fileContent: string,
): Promise<AnyCircuitElement[]> => {
  const schematicMetadata = parseKicadSymToSchematicMetadata(fileContent)
  const pinNumbers = [
    ...new Set(
      [
        ...Object.values(schematicMetadata.port_arrangement ?? {}).flatMap(
          (side) => side.pins,
        ),
        ...Object.keys(schematicMetadata.port_labels ?? {}).map((pin) =>
          Number(pin),
        ),
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
      ...schematicMetadata,
    } as any,
  ]

  for (const pinNumber of pinNumbers) {
    const source_port_id = `source_port_${pinNumber}`
    const pin_label = schematicMetadata.port_labels?.[`${pinNumber}`]

    circuitJson.push({
      type: "source_port",
      source_port_id,
      source_component_id: "source_component_0",
      name: `${pinNumber}`,
      port_hints: pin_label ? [`${pinNumber}`, pin_label] : [`${pinNumber}`],
      pin_number: pinNumber,
      pin_label,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${pinNumber}`,
      source_port_id,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
    } as any)
  }

  return circuitJson
}

export const applyKicadSymToCircuitJson = (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): AnyCircuitElement[] => {
  const schematicMetadata = parseKicadSymToSchematicMetadata(kicadSym)

  return circuitJson.map((element: any) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        port_arrangement: schematicMetadata.port_arrangement,
        port_labels: schematicMetadata.port_labels,
      }
    }

    if (element.type === "source_port" && schematicMetadata.port_labels) {
      const pinKey =
        element.pin_number !== undefined
          ? `${element.pin_number}`
          : element.name
      const pinLabel = schematicMetadata.port_labels[pinKey]
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

export const parseKicadSymMetadata = parseKicadSymToSchematicMetadata
