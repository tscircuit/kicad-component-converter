import parseSExpression from "s-expression"

type PinSide = "left_side" | "right_side" | "top_side" | "bottom_side"

export interface KicadSymSchematicProps {
  schPortArrangement: {
    left_side?: { pins: number[]; direction?: "top-to-bottom" }
    right_side?: { pins: number[]; direction?: "top-to-bottom" }
    top_side?: { pins: number[]; direction?: "left-to-right" }
    bottom_side?: { pins: number[]; direction?: "left-to-right" }
  }
  pinLabels: Record<string, string>
}

interface KicadSymbolPin {
  number: number
  name?: string
  x: number
  y: number
  rotation: number
}

const atomValue = (value: any) => value?.valueOf?.() ?? value

const findChild = (row: any[], childName: string) =>
  row.find((child) => Array.isArray(child) && atomValue(child[0]) === childName)

const collectRows = (node: any, rowName: string, rows: any[] = []) => {
  if (!Array.isArray(node)) return rows
  if (atomValue(node[0]) === rowName) rows.push(node)
  for (const child of node) collectRows(child, rowName, rows)
  return rows
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360

const getPinSide = (pin: KicadSymbolPin): PinSide => {
  switch (normalizeRotation(pin.rotation)) {
    case 0:
      return "left_side"
    case 90:
      return "bottom_side"
    case 180:
      return "right_side"
    case 270:
      return "top_side"
    default:
      return Math.abs(pin.x) >= Math.abs(pin.y)
        ? pin.x <= 0
          ? "left_side"
          : "right_side"
        : pin.y <= 0
          ? "bottom_side"
          : "top_side"
  }
}

const sortPinsForSide = (side: PinSide, pins: KicadSymbolPin[]) => {
  return [...pins].sort((a, b) =>
    side === "top_side" || side === "bottom_side"
      ? a.x - b.x || a.number - b.number
      : b.y - a.y || a.number - b.number,
  )
}

const parsePin = (row: any[]): KicadSymbolPin | undefined => {
  const at = findChild(row, "at")
  const number = findChild(row, "number")
  if (!at || !number) return undefined

  const pinNumber = Number(atomValue(number[1]))
  if (!Number.isFinite(pinNumber)) return undefined

  const name = findChild(row, "name")
  return {
    number: pinNumber,
    name: name ? String(atomValue(name[1])) : undefined,
    x: Number(atomValue(at[1])) || 0,
    y: Number(atomValue(at[2])) || 0,
    rotation: Number(atomValue(at[3])) || 0,
  }
}

export const parseKicadSymToSchematicProps = (
  fileContent: string,
): KicadSymSchematicProps => {
  const kicadSExpr = parseSExpression(fileContent)
  const pinsByNumber = new Map<number, KicadSymbolPin>()

  for (const row of collectRows(kicadSExpr, "pin")) {
    const pin = parsePin(row)
    if (pin) pinsByNumber.set(pin.number, pin)
  }

  const pinsBySide = new Map<PinSide, KicadSymbolPin[]>()
  const pinLabels: Record<string, string> = {}

  for (const pin of pinsByNumber.values()) {
    const side = getPinSide(pin)
    pinsBySide.set(side, [...(pinsBySide.get(side) ?? []), pin])
    if (pin.name) pinLabels[String(pin.number)] = pin.name
  }

  const schPortArrangement: KicadSymSchematicProps["schPortArrangement"] = {}

  for (const side of [
    "left_side",
    "right_side",
    "top_side",
    "bottom_side",
  ] as const) {
    const pins = pinsBySide.get(side)
    if (!pins?.length) continue
    const sortedPins = sortPinsForSide(side, pins).map((pin) => pin.number)
    if (side === "left_side" || side === "right_side") {
      schPortArrangement[side] = {
        pins: sortedPins,
        direction: "top-to-bottom",
      }
    } else {
      schPortArrangement[side] = {
        pins: sortedPins,
        direction: "left-to-right",
      }
    }
  }

  return { schPortArrangement, pinLabels }
}
