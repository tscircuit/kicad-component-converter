import parseSExpression from "s-expression"

export interface KicadSymbolPinMetadata {
  number: string
  name?: string
  x: number
  y: number
  rotation: number
}

export interface KicadSymbolMetadata {
  symbolName: string
  pins: KicadSymbolPinMetadata[]
}

const rowName = (row: any) => row?.[0]?.valueOf?.() ?? row?.[0]

const rowValue = (row: any, index: number) => row?.[index]?.valueOf?.()

const findAttr = (row: any[], attrName: string) =>
  row.find((child) => Array.isArray(child) && rowName(child) === attrName)

const parseNumber = (value: any) => {
  const parsed = Number(value?.valueOf?.() ?? value)
  return Number.isFinite(parsed) ? parsed : 0
}

const getPinSide = (pin: KicadSymbolPinMetadata) => {
  const normalizedRotation = ((pin.rotation % 360) + 360) % 360

  if (normalizedRotation === 0) return "left"
  if (normalizedRotation === 180) return "right"
  if (normalizedRotation === 90) return "bottom"
  if (normalizedRotation === 270) return "top"

  const absX = Math.abs(pin.x)
  const absY = Math.abs(pin.y)
  if (absX >= absY) return pin.x < 0 ? "left" : "right"
  return pin.y < 0 ? "bottom" : "top"
}

const sortPinsBySidePosition = (
  a: KicadSymbolPinMetadata,
  b: KicadSymbolPinMetadata,
) => {
  const side = getPinSide(a)
  if (side === "left" || side === "right") {
    return b.y - a.y || a.x - b.x || a.number.localeCompare(b.number)
  }
  return a.x - b.x || b.y - a.y || a.number.localeCompare(b.number)
}

export const getSchPortArrangementFromKicadPins = (
  pins: KicadSymbolPinMetadata[],
) => {
  const sides = {
    left: [] as KicadSymbolPinMetadata[],
    right: [] as KicadSymbolPinMetadata[],
    top: [] as KicadSymbolPinMetadata[],
    bottom: [] as KicadSymbolPinMetadata[],
  }

  for (const pin of pins) {
    sides[getPinSide(pin)].push(pin)
  }

  const arrangement: Record<string, { pins: string[]; direction: string }> = {}
  const sideConfig = [
    ["left", "left_side", "top-to-bottom"],
    ["right", "right_side", "top-to-bottom"],
    ["top", "top_side", "left-to-right"],
    ["bottom", "bottom_side", "left-to-right"],
  ] as const

  for (const [side, key, direction] of sideConfig) {
    const sidePins = sides[side]
    if (sidePins.length === 0) continue
    arrangement[key] = {
      pins: sidePins.sort(sortPinsBySidePosition).map((pin) => pin.number),
      direction,
    }
  }

  return arrangement
}

export const getPortLabelsFromKicadPins = (pins: KicadSymbolPinMetadata[]) => {
  const portLabels: Record<string, string> = {}

  for (const pin of pins) {
    const label = pin.name?.trim()
    if (!label || label === "~") continue
    portLabels[pin.number] = label
  }

  return portLabels
}

export const parseKicadSymToSymbolMetadata = (
  fileContent: string,
): KicadSymbolMetadata => {
  const root = parseSExpression(fileContent) as any[]
  const rootName = rowName(root)
  const symbolRows =
    rootName === "symbol"
      ? [root]
      : root.filter((row) => Array.isArray(row) && rowName(row) === "symbol")
  const symbolRow =
    symbolRows.find((row) =>
      row.some(
        (child: any) => Array.isArray(child) && rowName(child) === "pin",
      ),
    ) ?? symbolRows[0]

  if (!symbolRow) {
    throw new Error("No symbol found in KiCad symbol file")
  }

  const symbolName = String(rowValue(symbolRow, 1) ?? "")
  const pins: KicadSymbolPinMetadata[] = []

  for (const row of symbolRow) {
    if (!Array.isArray(row) || rowName(row) !== "pin") continue

    const at = findAttr(row, "at")
    const name = findAttr(row, "name")
    const number = findAttr(row, "number")
    const pinNumber = rowValue(number, 1)
    if (pinNumber === undefined || pinNumber === "") continue

    pins.push({
      number: String(pinNumber),
      name:
        rowValue(name, 1) !== undefined ? String(rowValue(name, 1)) : undefined,
      x: parseNumber(rowValue(at, 1)),
      y: parseNumber(rowValue(at, 2)),
      rotation: parseNumber(rowValue(at, 3)),
    })
  }

  return { symbolName, pins }
}
