import type { AnyCircuitElement } from "circuit-json"
import parseSExpression from "s-expression"

type SExpr = Array<any>
type PinIdentifier = number | string
type HorizontalDirection = "top-to-bottom" | "bottom-to-top"
type VerticalDirection = "left-to-right" | "right-to-left"

export interface KicadSymPin {
  name?: string
  number: string
  identifier: PinIdentifier
  x: number
  y: number
  rotation: number
  length?: number
}

export interface KicadSymSchematicMetadata {
  symbolName: string
  pins: KicadSymPin[]
  schPortArrangement: {
    leftSide?: { pins: PinIdentifier[]; direction: HorizontalDirection }
    rightSide?: { pins: PinIdentifier[]; direction: HorizontalDirection }
    topSide?: { pins: PinIdentifier[]; direction: VerticalDirection }
    bottomSide?: { pins: PinIdentifier[]; direction: VerticalDirection }
  }
  portArrangement: {
    left_side?: { pins: PinIdentifier[]; direction: HorizontalDirection }
    right_side?: { pins: PinIdentifier[]; direction: HorizontalDirection }
    top_side?: { pins: PinIdentifier[]; direction: VerticalDirection }
    bottom_side?: { pins: PinIdentifier[]; direction: VerticalDirection }
  }
  pinLabels: Record<string, string>
  portLabels: Record<string, string>
}

export interface ParseKicadSymOptions {
  symbolName?: string
}

const atomToString = (value: any): string => {
  if (value === undefined || value === null) return ""
  return String(value.valueOf())
}

const isSExpr = (value: any): value is SExpr => Array.isArray(value)

const getToken = (row: any) => (isSExpr(row) ? atomToString(row[0]) : "")

const getChild = (row: SExpr, token: string) =>
  row.find((child) => getToken(child) === token) as SExpr | undefined

const parseNumber = (value: any, fallback = 0) => {
  const parsed = Number.parseFloat(atomToString(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360

const pinIdentifierFromNumber = (pinNumber: string): PinIdentifier => {
  return /^\d+$/.test(pinNumber) ? Number.parseInt(pinNumber, 10) : pinNumber
}

const pinLabelKey = (identifier: PinIdentifier) => `pin${identifier}`

const normalizePinLabel = (pinName?: string) => {
  if (!pinName) return undefined
  const trimmed = pinName.trim()
  return trimmed && trimmed !== "~" ? trimmed : undefined
}

const getPinSide = (rotation: number): "left" | "right" | "top" | "bottom" => {
  const normalized = normalizeRotation(rotation)
  if (normalized >= 315 || normalized < 45) return "left"
  if (normalized >= 45 && normalized < 135) return "bottom"
  if (normalized >= 135 && normalized < 225) return "right"
  return "top"
}

const parsePin = (row: SExpr): KicadSymPin | undefined => {
  const at = getChild(row, "at")
  const length = getChild(row, "length")
  const name = getChild(row, "name")
  const number = getChild(row, "number")
  const pinNumber = atomToString(number?.[1])

  if (!pinNumber) return undefined

  return {
    name: normalizePinLabel(atomToString(name?.[1])),
    number: pinNumber,
    identifier: pinIdentifierFromNumber(pinNumber),
    x: parseNumber(at?.[1]),
    y: parseNumber(at?.[2]),
    rotation: parseNumber(at?.[3]),
    length: length ? parseNumber(length[1]) : undefined,
  }
}

const collectPins = (row: SExpr): KicadSymPin[] => {
  const pins: KicadSymPin[] = []

  for (const child of row.slice(2)) {
    if (!isSExpr(child)) continue
    const token = getToken(child)
    if (token === "pin") {
      const pin = parsePin(child)
      if (pin) pins.push(pin)
    } else if (token === "symbol") {
      pins.push(...collectPins(child))
    }
  }

  return pins
}

const uniquePins = (pins: KicadSymPin[]) => {
  const seen = new Set<string>()
  const deduped: KicadSymPin[] = []

  for (const pin of pins) {
    const key = `${pin.number}:${pin.name ?? ""}:${pin.x}:${pin.y}:${pin.rotation}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(pin)
  }

  return deduped
}

const sortSidePins = (pins: KicadSymPin[], side: string) => {
  return [...pins].sort((a, b) => {
    if (side === "left" || side === "right") {
      return b.y - a.y || a.x - b.x
    }
    return a.x - b.x || b.y - a.y
  })
}

const createMetadata = (symbolName: string, pins: KicadSymPin[]) => {
  const pinsBySide = {
    left: [] as KicadSymPin[],
    right: [] as KicadSymPin[],
    top: [] as KicadSymPin[],
    bottom: [] as KicadSymPin[],
  }

  for (const pin of pins) {
    pinsBySide[getPinSide(pin.rotation)].push(pin)
  }

  const leftPins = sortSidePins(pinsBySide.left, "left").map(
    (pin) => pin.identifier,
  )
  const rightPins = sortSidePins(pinsBySide.right, "right").map(
    (pin) => pin.identifier,
  )
  const topPins = sortSidePins(pinsBySide.top, "top").map(
    (pin) => pin.identifier,
  )
  const bottomPins = sortSidePins(pinsBySide.bottom, "bottom").map(
    (pin) => pin.identifier,
  )

  const pinLabels: Record<string, string> = {}
  for (const pin of pins) {
    if (pin.name) pinLabels[pinLabelKey(pin.identifier)] = pin.name
  }

  return {
    symbolName,
    pins,
    schPortArrangement: {
      ...(leftPins.length
        ? { leftSide: { pins: leftPins, direction: "top-to-bottom" as const } }
        : {}),
      ...(rightPins.length
        ? {
            rightSide: { pins: rightPins, direction: "top-to-bottom" as const },
          }
        : {}),
      ...(topPins.length
        ? { topSide: { pins: topPins, direction: "left-to-right" as const } }
        : {}),
      ...(bottomPins.length
        ? {
            bottomSide: {
              pins: bottomPins,
              direction: "left-to-right" as const,
            },
          }
        : {}),
    },
    portArrangement: {
      ...(leftPins.length
        ? { left_side: { pins: leftPins, direction: "top-to-bottom" as const } }
        : {}),
      ...(rightPins.length
        ? {
            right_side: {
              pins: rightPins,
              direction: "top-to-bottom" as const,
            },
          }
        : {}),
      ...(topPins.length
        ? { top_side: { pins: topPins, direction: "left-to-right" as const } }
        : {}),
      ...(bottomPins.length
        ? {
            bottom_side: {
              pins: bottomPins,
              direction: "left-to-right" as const,
            },
          }
        : {}),
    },
    pinLabels,
    portLabels: pinLabels,
  } satisfies KicadSymSchematicMetadata
}

const getTopLevelSymbols = (root: SExpr) => {
  if (getToken(root) === "symbol") return [root]
  if (getToken(root) !== "kicad_symbol_lib") return []
  return root.filter((child) => getToken(child) === "symbol") as SExpr[]
}

export const parseKicadSymToSchematicMetadata = (
  kicadSym: string,
  options: ParseKicadSymOptions = {},
): KicadSymSchematicMetadata[] => {
  const root = parseSExpression(kicadSym) as SExpr
  const symbols = getTopLevelSymbols(root)
  const results: KicadSymSchematicMetadata[] = []

  for (const symbol of symbols) {
    const symbolName = atomToString(symbol[1])
    if (options.symbolName && symbolName !== options.symbolName) continue

    const pins = uniquePins(collectPins(symbol))
    if (pins.length === 0) continue

    results.push(createMetadata(symbolName, pins))
  }

  return results
}

export const createCircuitJsonFromKicadSymMetadata = (
  metadata: KicadSymSchematicMetadata,
): AnyCircuitElement[] => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_0",
      name: metadata.symbolName,
      ftype: "simple_chip",
    } as any,
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_0",
      source_component_id: "source_component_0",
      center: { x: 0, y: 0 },
      rotation: 0,
      size: { width: 2, height: Math.max(1, metadata.pins.length * 0.2) },
      is_box_with_pins: true,
      port_arrangement: metadata.portArrangement,
      port_labels: metadata.portLabels,
    } as any,
  ]

  for (const [index, pin] of metadata.pins.entries()) {
    const sourcePortId = `source_port_${index}`
    const schematicPortId = `schematic_port_${index}`
    const displayPinLabel = pin.name ?? pin.number

    circuitJson.push({
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id: "source_component_0",
      name: pin.number,
      port_hints: [pin.number, displayPinLabel],
      pin_number:
        typeof pin.identifier === "number" ? pin.identifier : undefined,
      pin_label: pinLabelKey(pin.identifier),
    } as any)
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: schematicPortId,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
      pin_number:
        typeof pin.identifier === "number" ? pin.identifier : undefined,
      display_pin_label: displayPinLabel,
      side_of_component: getPinSide(pin.rotation),
    } as any)
  }

  return circuitJson
}

export const applyKicadSymSchematicMetadata = (
  circuitJson: AnyCircuitElement[],
  metadata: KicadSymSchematicMetadata,
): AnyCircuitElement[] => {
  const findMatchingPin = (element: any) => {
    const elementPinNumber =
      typeof element.pin_number === "number" ? element.pin_number : undefined
    const elementNames = [
      element.name,
      element.pin_label,
      ...(Array.isArray(element.port_hints) ? element.port_hints : []),
    ].map((value) => atomToString(value))

    return metadata.pins.find((pin) => {
      if (
        typeof pin.identifier === "number" &&
        pin.identifier === elementPinNumber
      ) {
        return true
      }
      return (
        elementNames.includes(pin.number) ||
        elementNames.includes(pin.name ?? "")
      )
    })
  }

  const sourcePortPinById = new Map<string, KicadSymPin>()
  for (const element of circuitJson as any[]) {
    if (element.type !== "source_port") continue
    const matchingPin = findMatchingPin(element)
    if (matchingPin) sourcePortPinById.set(element.source_port_id, matchingPin)
  }

  return circuitJson.map((element: any) => {
    if (element.type === "schematic_component") {
      return {
        ...element,
        size:
          element.size?.width && element.size?.height
            ? element.size
            : { width: 2, height: Math.max(1, metadata.pins.length * 0.2) },
        is_box_with_pins: true,
        port_arrangement: metadata.portArrangement,
        port_labels: metadata.portLabels,
      }
    }

    if (element.type !== "source_port" && element.type !== "schematic_port") {
      return element
    }

    const matchingPin =
      element.type === "schematic_port"
        ? (sourcePortPinById.get(element.source_port_id) ??
          findMatchingPin(element))
        : findMatchingPin(element)

    if (!matchingPin) return element

    const displayPinLabel = matchingPin.name ?? matchingPin.number
    if (element.type === "source_port") {
      return {
        ...element,
        port_hints: Array.from(
          new Set([
            ...(element.port_hints ?? []),
            matchingPin.number,
            displayPinLabel,
          ]),
        ),
        pin_number:
          typeof matchingPin.identifier === "number"
            ? matchingPin.identifier
            : element.pin_number,
        pin_label: pinLabelKey(matchingPin.identifier),
      }
    }

    return {
      ...element,
      pin_number:
        typeof matchingPin.identifier === "number"
          ? matchingPin.identifier
          : element.pin_number,
      display_pin_label: displayPinLabel,
      side_of_component: getPinSide(matchingPin.rotation),
    }
  })
}
