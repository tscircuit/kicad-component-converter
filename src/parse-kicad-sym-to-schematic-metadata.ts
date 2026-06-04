import parseSExpression from "s-expression"
import { getAttr } from "./get-attr"

type PinSide = "leftSide" | "rightSide" | "topSide" | "bottomSide"

export interface KicadSymSchematicMetadata {
  pinLabels: Record<string, string>
  schPortArrangement: Partial<
    Record<
      PinSide,
      {
        pins: string[]
        direction:
          | "top-to-bottom"
          | "left-to-right"
          | "bottom-to-top"
          | "right-to-left"
      }
    >
  >
}

interface KicadSymPin {
  pinKey: string
  label: string
  at: number[]
  side: PinSide
}

const toPrimitive = (value: any) => value?.valueOf?.() ?? value

const getNodeName = (node: any) =>
  Array.isArray(node) ? toPrimitive(node[0]) : undefined

const walkSExpr = (node: any, visit: (node: any[]) => void) => {
  if (!Array.isArray(node)) return
  visit(node)
  for (const child of node) {
    walkSExpr(child, visit)
  }
}

const getPinText = (pinNode: any[], key: "name" | "number") => {
  const textNode = pinNode.find((child) => getNodeName(child) === key)
  const text = Array.isArray(textNode) ? toPrimitive(textNode[1]) : undefined
  return typeof text === "string" ? text : undefined
}

const getPinSide = (rotation: number): PinSide => {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 180) return "rightSide"
  if (normalized === 90) return "bottomSide"
  if (normalized === 270) return "topSide"
  return "leftSide"
}

const sortPinsForSide = (side: PinSide, pins: KicadSymPin[]) => {
  return [...pins].sort((a, b) => {
    if (side === "leftSide" || side === "rightSide") {
      return b.at[1] - a.at[1] || a.at[0] - b.at[0]
    }
    return a.at[0] - b.at[0] || b.at[1] - a.at[1]
  })
}

export const parseKicadSymToSchematicMetadata = (
  fileContent: string,
): KicadSymSchematicMetadata => {
  const kicadSExpr = parseSExpression(fileContent)
  const pins: KicadSymPin[] = []

  walkSExpr(kicadSExpr, (node) => {
    if (getNodeName(node) !== "pin") return

    const pinNumber = getPinText(node, "number")
    if (!pinNumber) return

    const pinName = getPinText(node, "name")
    const at = getAttr(node, "at")
    if (!Array.isArray(at) || at.length < 2) return

    const rotation = at[2] ?? 0
    const pinKey = `pin${pinNumber}`
    pins.push({
      pinKey,
      label: pinName && pinName !== "~" ? pinName : pinKey,
      at,
      side: getPinSide(rotation),
    })
  })

  const pinLabels: Record<string, string> = {}
  const pinsBySide = new Map<PinSide, KicadSymPin[]>()
  for (const pin of pins) {
    pinLabels[pin.pinKey] = pin.label
    pinsBySide.set(pin.side, [...(pinsBySide.get(pin.side) ?? []), pin])
  }

  const schPortArrangement: KicadSymSchematicMetadata["schPortArrangement"] = {}
  const sideDirections = {
    leftSide: "top-to-bottom",
    rightSide: "top-to-bottom",
    topSide: "left-to-right",
    bottomSide: "left-to-right",
  } as const

  for (const side of [
    "leftSide",
    "rightSide",
    "topSide",
    "bottomSide",
  ] as const) {
    const sidePins = pinsBySide.get(side)
    if (!sidePins?.length) continue

    schPortArrangement[side] = {
      pins: sortPinsForSide(side, sidePins).map((pin) => pin.pinKey),
      direction: sideDirections[side],
    }
  }

  return { pinLabels, schPortArrangement }
}
