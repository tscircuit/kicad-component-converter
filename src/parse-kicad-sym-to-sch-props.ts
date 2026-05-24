import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"
import { getAttr } from "./get-attr"

type SchSide = "leftSide" | "rightSide" | "topSide" | "bottomSide"
type SchDirection = "top-to-bottom" | "bottom-to-top" | "left-to-right"

export interface KicadSymPin {
  number: string
  name: string
  at: [number, number, number?]
}

export interface KicadSymSchematicProps {
  pinLabels: Record<string, string>
  schPinArrangement: Partial<
    Record<SchSide, { pins: string[]; direction: SchDirection }>
  >
  pins: KicadSymPin[]
}

const asString = (value: any) => `${value?.valueOf?.() ?? value}`

const getTextAttr = (row: any[], key: string) => {
  const attr = row.find((item) => Array.isArray(item) && item[0] === key)
  return attr?.[1] !== undefined ? asString(attr[1]) : undefined
}

const collectRows = (node: any, rowName: string, rows: any[][] = []) => {
  if (!Array.isArray(node)) return rows
  if (node[0] === rowName) {
    rows.push(node)
  }
  for (const child of node) {
    collectRows(child, rowName, rows)
  }
  return rows
}

const getPinKey = (pinNumber: string) => `pin${pinNumber}`

const getSideFromRotation = (rotation: number | undefined): SchSide => {
  const normalized = (((rotation ?? 0) % 360) + 360) % 360
  if (normalized === 180) return "rightSide"
  if (normalized === 90) return "bottomSide"
  if (normalized === 270) return "topSide"
  return "leftSide"
}

const sortPinsForSide = (side: SchSide, pins: KicadSymPin[]) => {
  return [...pins].sort((a, b) => {
    if (side === "topSide" || side === "bottomSide") return a.at[0] - b.at[0]
    return b.at[1] - a.at[1]
  })
}

export const parseKicadSymToSchematicProps = (
  fileContent: string,
): KicadSymSchematicProps => {
  const kicadSExpr = parseSExpression(fileContent)
  const pinRows = collectRows(kicadSExpr, "pin")

  const pins = pinRows
    .map((row) => {
      const number = getTextAttr(row, "number")
      const name = getTextAttr(row, "name")
      const at = getAttr(row, "at") as number[] | undefined
      if (!number || !name || !at || at.length < 2) return null
      return {
        number,
        name,
        at: [at[0]!, at[1]!, at[2] ?? 0] as [number, number, number],
      }
    })
    .filter((pin): pin is KicadSymPin => Boolean(pin))

  const pinLabels = Object.fromEntries(
    pins.map((pin) => [getPinKey(pin.number), pin.name]),
  )

  const groupedPins: Record<SchSide, KicadSymPin[]> = {
    leftSide: [],
    rightSide: [],
    topSide: [],
    bottomSide: [],
  }

  for (const pin of pins) {
    groupedPins[getSideFromRotation(pin.at[2])].push(pin)
  }

  const schPinArrangement: KicadSymSchematicProps["schPinArrangement"] = {}
  for (const side of Object.keys(groupedPins) as SchSide[]) {
    if (groupedPins[side].length === 0) continue
    schPinArrangement[side] = {
      pins: sortPinsForSide(side, groupedPins[side]).map((pin) =>
        getPinKey(pin.number),
      ),
      direction:
        side === "topSide" || side === "bottomSide"
          ? "left-to-right"
          : "top-to-bottom",
    }
  }

  return { pinLabels, schPinArrangement, pins }
}

export const createCircuitJsonFromKicadSymProps = (
  props: KicadSymSchematicProps,
): AnyCircuitElement[] => {
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
      size: getSchematicSize(props.pins),
    } as any,
  ]

  props.pins.forEach((pin, index) => {
    const sourcePortId = `source_port_${index}`
    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: pin.number,
      port_hints: [pin.number, getPinKey(pin.number), pin.name],
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
      center: { x: pin.at[0], y: -pin.at[1] },
    } as any)
  })

  return circuitJson
}

export const applyKicadSymPropsToCircuitJson = (
  circuitJson: AnyCircuitElement[],
  props: KicadSymSchematicProps,
) => {
  const pinByNumber = new Map(props.pins.map((pin) => [pin.number, pin]))
  const pinByName = new Map(props.pins.map((pin) => [pin.name, pin]))

  for (const element of circuitJson as any[]) {
    if (element.type === "schematic_component") {
      element.size = getSchematicSize(props.pins)
    }
    if (element.type !== "source_port") continue
    const hints = [
      element.name,
      element.pin_number,
      ...(element.port_hints ?? []),
    ]
      .filter((hint) => hint !== undefined && hint !== null)
      .map(String)
    const pin =
      hints
        .map((hint) => pinByNumber.get(hint) ?? pinByName.get(hint))
        .find(Boolean) ?? undefined
    if (!pin) continue
    element.pin_label = pin.name
    element.port_hints = Array.from(
      new Set([
        ...(element.port_hints ?? []),
        pin.number,
        getPinKey(pin.number),
        pin.name,
      ]),
    )
  }

  for (const schematicPort of circuitJson.filter(
    (element: any) => element.type === "schematic_port",
  ) as any[]) {
    const sourcePort = circuitJson.find(
      (element: any) =>
        element.type === "source_port" &&
        element.source_port_id === schematicPort.source_port_id,
    ) as any
    const hints = [
      sourcePort?.name,
      sourcePort?.pin_number,
      ...(sourcePort?.port_hints ?? []),
    ]
      .filter((hint) => hint !== undefined && hint !== null)
      .map(String)
    const pin =
      hints
        .map((hint) => pinByNumber.get(hint) ?? pinByName.get(hint))
        .find(Boolean) ?? undefined
    if (!pin) continue
    schematicPort.center = { x: pin.at[0], y: -pin.at[1] }
  }
}

export const addSchematicPropsToTscircuitCode = (
  code: string,
  props: KicadSymSchematicProps,
) => {
  if (Object.keys(props.schPinArrangement).length === 0) return code

  const arrangement = JSON.stringify(props.schPinArrangement, null, "  ")
  const propLine = `    schPinArrangement={${arrangement}}\n`

  if (code.includes("schPinArrangement={")) return code
  return code.replace(/(\s+\{\.\.\.props\})/, `\n${propLine}$1`)
}

const getSchematicSize = (pins: KicadSymPin[]) => {
  if (pins.length === 0) return { width: 0, height: 0 }
  const xs = pins.map((pin) => pin.at[0])
  const ys = pins.map((pin) => pin.at[1])
  return {
    width: Math.max(2, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(2, Math.max(...ys) - Math.min(...ys)),
  }
}
