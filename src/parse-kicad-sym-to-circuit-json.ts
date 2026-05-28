import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type KicadSymPin = {
  number: string
  name: string
  at: [number, number, number]
}

type PinSide = "left_side" | "right_side" | "top_side" | "bottom_side"

const unwrapValue = (value: any) => value?.valueOf?.() ?? value

const getAttr = (row: any[], key: string) => {
  const attr = row.find((item) => Array.isArray(item) && item[0] === key)
  return attr?.slice(1)
}

const toNumber = (value: any) => Number.parseFloat(`${unwrapValue(value)}`)

const collectPinRows = (node: any): any[][] => {
  if (!Array.isArray(node)) return []
  const own = node[0] === "pin" ? [node] : []
  return own.concat(node.flatMap((child) => collectPinRows(child)))
}

const parsePin = (pinRow: any[]): KicadSymPin => {
  const numberAttr = getAttr(pinRow, "number")
  const nameAttr = getAttr(pinRow, "name")
  const atAttr = getAttr(pinRow, "at")

  return {
    number: `${unwrapValue(numberAttr?.[0])}`,
    name: `${unwrapValue(nameAttr?.[0])}`,
    at: [
      toNumber(atAttr?.[0]),
      toNumber(atAttr?.[1]),
      toNumber(atAttr?.[2] ?? 0),
    ],
  }
}

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360

const getPinSide = (pin: KicadSymPin): PinSide => {
  const rotation = normalizeDegrees(pin.at[2])
  if (rotation === 0) return "left_side"
  if (rotation === 180) return "right_side"
  if (rotation === 90) return "bottom_side"
  if (rotation === 270) return "top_side"
  throw new Error(`Unsupported KiCad symbol pin rotation: ${pin.at[2]}`)
}

const sortPinsForSide = (side: PinSide, pins: KicadSymPin[]) => {
  return [...pins].sort((a, b) => {
    if (side === "left_side" || side === "right_side") return a.at[1] - b.at[1]
    return a.at[0] - b.at[0]
  })
}

export const parseKicadSymPins = (kicadSym: string): KicadSymPin[] => {
  const parsed = parseSExpression(kicadSym)
  const pins = collectPinRows(parsed).map(parsePin)
  if (pins.length === 0) throw new Error("No pins found in KiCad symbol")
  return pins
}

export const applyKicadSymToCircuitJson = (
  circuitJson: AnyCircuitElement[],
  kicadSym: string,
): AnyCircuitElement[] => {
  const pins = parseKicadSymPins(kicadSym)
  const pinsByNumber = new Map(pins.map((pin) => [pin.number, pin]))
  const portLabels = Object.fromEntries(
    pins.map((pin) => [pin.number, pin.name]),
  )
  const pinsBySide: Record<PinSide, KicadSymPin[]> = {
    left_side: [],
    right_side: [],
    top_side: [],
    bottom_side: [],
  }

  for (const pin of pins) {
    pinsBySide[getPinSide(pin)].push(pin)
  }

  const portArrangement = Object.fromEntries(
    (Object.keys(pinsBySide) as PinSide[])
      .map((side) => {
        const sidePins = sortPinsForSide(side, pinsBySide[side])
        if (sidePins.length === 0) return undefined
        return [
          side,
          {
            pins: sidePins.map((pin) => Number.parseInt(pin.number, 10)),
          },
        ]
      })
      .filter(Boolean) as Array<[PinSide, { pins: number[] }]>,
  )

  return circuitJson.map((element: any) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        port_arrangement: portArrangement,
        port_labels: portLabels,
      }
    }

    if (element.type !== "source_port") return element

    const pin = pinsByNumber.get(`${element.pin_number ?? element.name}`)
    if (!pin) return element

    return {
      ...element,
      pin_label: pin.name,
      port_hints: [`pin${pin.number}`, pin.name],
    }
  }) as AnyCircuitElement[]
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const pins = parseKicadSymPins(kicadSym)
  const sourceComponentId = "source_component_0"
  const schematicComponentId = "schematic_component_0"
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: sourceComponentId,
      supplier_part_numbers: {},
    } as any,
    {
      type: "schematic_component",
      schematic_component_id: schematicComponentId,
      source_component_id: sourceComponentId,
      center: { x: 0, y: 0 },
      rotation: 0,
      size: { width: 0, height: 0 },
    } as any,
  ]

  let sourcePortId = 0
  for (const pin of pins) {
    const sourcePortIdForPin = `source_port_${sourcePortId++}`
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortIdForPin,
      source_component_id: sourceComponentId,
      name: pin.number,
      port_hints: [`pin${pin.number}`, pin.name],
      pin_number: Number.parseInt(pin.number, 10),
      pin_label: pin.name,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${sourcePortId++}`,
      source_port_id: sourcePortIdForPin,
      schematic_component_id: schematicComponentId,
      center: { x: 0, y: 0 },
    } as any)
  }

  return applyKicadSymToCircuitJson(circuitJson, kicadSym)
}
