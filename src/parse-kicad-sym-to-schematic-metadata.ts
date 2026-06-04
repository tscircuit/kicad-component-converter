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

interface ParsedPin {
  number: number
  name: string
  x: number
  y: number
  rotation: number
}

const toValue = (value: any) => value?.valueOf?.() ?? value

const findRows = (node: any, rowName: string, rows: any[][] = []) => {
  if (!Array.isArray(node)) return rows
  if (toValue(node[0]) === rowName) {
    rows.push(node)
  }
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

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized >= 315 || normalized < 45) return 0
  if (normalized >= 45 && normalized < 135) return 90
  if (normalized >= 135 && normalized < 225) return 180
  return 270
}

const pinSideFromRotation = (rotation: number) => {
  switch (normalizeRotation(rotation)) {
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

export const parseKicadSymToSchematicMetadata = (
  fileContent: string,
): KicadSymSchematicMetadata => {
  const root = parseSExpression(fileContent)
  const pins: ParsedPin[] = []

  for (const pinRow of findRows(root, "pin")) {
    const numberText = getStringChild(pinRow, "number")
    const name = getStringChild(pinRow, "name")
    const at = getAt(pinRow)
    const number =
      numberText !== undefined ? Number.parseInt(numberText, 10) : Number.NaN
    if (!Number.isFinite(number) || !name || !at) continue
    pins.push({ number, name, ...at })
  }

  const uniquePins = [...new Map(pins.map((pin) => [pin.number, pin])).values()]
  const grouped = {
    left_side: [] as ParsedPin[],
    right_side: [] as ParsedPin[],
    top_side: [] as ParsedPin[],
    bottom_side: [] as ParsedPin[],
  }

  for (const pin of uniquePins) {
    grouped[pinSideFromRotation(pin.rotation)].push(pin)
  }

  const port_arrangement: KicadSymSchematicMetadata["port_arrangement"] = {}

  if (grouped.left_side.length > 0) {
    port_arrangement.left_side = {
      pins: grouped.left_side
        .sort((a, b) => b.y - a.y)
        .map((pin) => pin.number),
      direction: "top-to-bottom",
    }
  }
  if (grouped.right_side.length > 0) {
    port_arrangement.right_side = {
      pins: grouped.right_side
        .sort((a, b) => b.y - a.y)
        .map((pin) => pin.number),
      direction: "top-to-bottom",
    }
  }
  if (grouped.top_side.length > 0) {
    port_arrangement.top_side = {
      pins: grouped.top_side.sort((a, b) => a.x - b.x).map((pin) => pin.number),
      direction: "left-to-right",
    }
  }
  if (grouped.bottom_side.length > 0) {
    port_arrangement.bottom_side = {
      pins: grouped.bottom_side
        .sort((a, b) => a.x - b.x)
        .map((pin) => pin.number),
      direction: "left-to-right",
    }
  }

  const port_labels = Object.fromEntries(
    uniquePins.map((pin) => [String(pin.number), pin.name]),
  )

  return {
    port_arrangement:
      Object.keys(port_arrangement).length > 0 ? port_arrangement : undefined,
    port_labels: Object.keys(port_labels).length > 0 ? port_labels : undefined,
  }
}
