import parseSExpression from "s-expression"
import type { AnyCircuitElement } from "circuit-json"
import { getAttr } from "./get-attr"

type KicadSymbolPin = {
  number: string
  name: string
  at: number[]
  rotation: number
}

type PortSide = "left_side" | "right_side" | "top_side" | "bottom_side"

const normalizeToken = (value: any) => value?.valueOf?.() ?? value

const collectRows = (row: any, type: string, out: any[] = []) => {
  if (!Array.isArray(row)) return out
  if (normalizeToken(row[0]) === type) out.push(row)
  for (const child of row.slice(1)) {
    collectRows(child, type, out)
  }
  return out
}

const getNestedTextAttr = (row: any[], key: string) => {
  const attr = row.find((item) => Array.isArray(item) && item[0] === key)
  if (!attr) return undefined
  return normalizeToken(attr[1])
}

const normalizeRotation = (deg: number) => ((deg % 360) + 360) % 360

const getPinSide = (pin: KicadSymbolPin): PortSide => {
  const rotation = normalizeRotation(pin.rotation)
  if (rotation === 180) return "right_side"
  if (rotation === 90) return "bottom_side"
  if (rotation === 270) return "top_side"
  return "left_side"
}

const sortPinsOnSide = (pins: KicadSymbolPin[], side: PortSide) => {
  return [...pins].sort((a, b) => {
    if (side === "top_side" || side === "bottom_side") {
      return a.at[0] - b.at[0]
    }
    return b.at[1] - a.at[1]
  })
}

export const parseKicadSymToPinMetadata = (
  kicadSym: string,
): {
  pins: KicadSymbolPin[]
  portArrangement: NonNullable<
    Extract<
      AnyCircuitElement,
      { type: "schematic_component" }
    >["port_arrangement"]
  >
  portLabels: Record<string, string>
} => {
  const kicadSExpr = parseSExpression(kicadSym)
  const pinRows = collectRows(kicadSExpr, "pin")

  const pins = pinRows
    .map((row) => {
      const number = getNestedTextAttr(row, "number")
      const name = getNestedTextAttr(row, "name")
      const at = getAttr(row, "at") ?? []
      if (!number || !name || at.length < 2) return undefined
      return {
        number: String(number),
        name: String(name),
        at,
        rotation: at[2] ?? 0,
      }
    })
    .filter(Boolean) as KicadSymbolPin[]

  const pinsBySide: Record<PortSide, KicadSymbolPin[]> = {
    left_side: [],
    right_side: [],
    top_side: [],
    bottom_side: [],
  }
  for (const pin of pins) {
    pinsBySide[getPinSide(pin)].push(pin)
  }

  const portArrangement: Record<string, any> = {}
  for (const side of [
    "left_side",
    "right_side",
    "top_side",
    "bottom_side",
  ] as const) {
    const sidePins = sortPinsOnSide(pinsBySide[side], side)
    if (sidePins.length === 0) continue
    portArrangement[side] = {
      pins: sidePins.map((pin) => Number(pin.number)).filter(Number.isFinite),
    }
  }

  const portLabels = Object.fromEntries(
    pins.map((pin) => [pin.number, pin.name]),
  )

  return { pins, portArrangement, portLabels }
}

export const enhanceCircuitJsonWithKicadSym = (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): AnyCircuitElement[] => {
  const { pins, portArrangement, portLabels } =
    parseKicadSymToPinMetadata(kicadSym)
  const pinByNumber = new Map(pins.map((pin) => [pin.number, pin]))

  return circuitJson.map((element) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        port_arrangement: portArrangement,
        port_labels: portLabels,
      } as AnyCircuitElement
    }

    if (element.type !== "source_port") return element

    const pin =
      pinByNumber.get(String((element as any).pin_number)) ??
      pinByNumber.get(String((element as any).name))

    if (!pin) return element

    return {
      ...element,
      name: pin.number,
      pin_number: Number.isFinite(Number(pin.number))
        ? Number(pin.number)
        : (element as any).pin_number,
      pin_label: pin.name,
      port_hints: Array.from(
        new Set([
          pin.number,
          pin.name,
          `pin${pin.number}`,
          ...((element as any).port_hints ?? []),
        ]),
      ),
    } as AnyCircuitElement
  })
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const { pins, portArrangement, portLabels } =
    parseKicadSymToPinMetadata(kicadSym)

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
      port_arrangement: portArrangement,
      port_labels: portLabels,
    } as any,
  ]

  pins.forEach((pin, index) => {
    const sourcePortId = `source_port_${index}`
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: pin.number,
      port_hints: [pin.number, pin.name, `pin${pin.number}`],
      pin_number: Number.isFinite(Number(pin.number))
        ? Number(pin.number)
        : undefined,
      pin_label: pin.name,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${index}`,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
    })
  })

  return circuitJson
}
