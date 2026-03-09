import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type PinDef = {
  name: string
  number: string
  x: number
  y: number
  rotation: number
  side: "left" | "right" | "top" | "bottom"
}

const textOf = (v: any): string => {
  if (v === undefined || v === null) return ""
  return typeof v?.valueOf === "function" ? String(v.valueOf()) : String(v)
}

const findRows = (node: any, key: string, out: any[] = []): any[] => {
  if (!Array.isArray(node)) return out
  if (textOf(node[0]) === key) out.push(node)
  for (const child of node) {
    if (Array.isArray(child)) findRows(child, key, out)
  }
  return out
}

const getAttrRow = (row: any[], key: string) =>
  row.find((child) => Array.isArray(child) && textOf(child[0]) === key)

const parsePin = (row: any[]): PinDef | null => {
  const at = getAttrRow(row, "at")
  const nameRow = getAttrRow(row, "name")
  const numberRow = getAttrRow(row, "number")
  if (!at || !nameRow || !numberRow) return null

  const x = Number(textOf(at[1]))
  const y = -Number(textOf(at[2]))
  const rotation = Number(textOf(at[3] ?? 0))
  const side: PinDef["side"] =
    rotation === 180
      ? "right"
      : rotation === 90
        ? "bottom"
        : rotation === 270
          ? "top"
          : "left"

  return {
    name: textOf(nameRow[1]),
    number: textOf(numberRow[1]),
    x,
    y,
    rotation,
    side,
  }
}

export const parseKicadSymToCircuitJson = async (
  kicadSym: string,
): Promise<AnyCircuitElement[]> => {
  const sym = parseSExpression(kicadSym)
  const symbolName = textOf(sym?.[1]) || "KicadSymbol"
  const pinRows = findRows(sym, "pin")
  const pins = pinRows.map(parsePin).filter(Boolean) as PinDef[]

  const source_component_id = "source_component_0"
  const schematic_component_id = "schematic_component_0"

  const minX = pins.length ? Math.min(...pins.map((p) => p.x)) : -5
  const maxX = pins.length ? Math.max(...pins.map((p) => p.x)) : 5
  const minY = pins.length ? Math.min(...pins.map((p) => p.y)) : -5
  const maxY = pins.length ? Math.max(...pins.map((p) => p.y)) : 5

  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id,
      name: symbolName,
      supplier_part_numbers: {},
    } as any,
    {
      type: "schematic_component",
      schematic_component_id,
      source_component_id,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      rotation: 0,
      size: {
        width: Math.max(10, maxX - minX + 10),
        height: Math.max(10, maxY - minY + 10),
      },
      schPortArrangement: {
        leftSide: pins.filter((p) => p.side === "left").map((p) => p.number),
        rightSide: pins.filter((p) => p.side === "right").map((p) => p.number),
        topSide: pins.filter((p) => p.side === "top").map((p) => p.number),
        bottomSide: pins.filter((p) => p.side === "bottom").map((p) => p.number),
      },
      pinLabels: Object.fromEntries(pins.map((p) => [p.number, p.name || p.number])),
    } as any,
  ]

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i]!
    const source_port_id = `source_port_${i}`
    const schematic_port_id = `schematic_port_${i}`
    circuitJson.push({
      type: "source_port",
      source_port_id,
      source_component_id,
      name: pin.number,
      port_hints: [pin.number, pin.name].filter(Boolean),
      pin_number: Number(pin.number),
      pin_label: pin.name || pin.number,
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id,
      schematic_component_id,
      source_port_id,
      center: { x: pin.x, y: pin.y },
      facingDirection: pin.side,
    } as any)
  }

  return circuitJson
}
