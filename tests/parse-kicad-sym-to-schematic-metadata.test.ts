import { test, expect } from "bun:test"
import {
  applyKicadSymMetadataToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "../src/parse-kicad-sym-to-schematic-metadata"

const simpleKicadSym = `
(kicad_symbol_lib
  (version 20231120)
  (generator "test")
  (symbol "Test:UsbPort"
    (pin power_in line (at -5.08 -2.54 0) (length 2.54)
      (name "VBUS" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at -5.08 0 0) (length 2.54)
      (name "D+" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at 5.08 0 180) (length 2.54)
      (name "D-" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
    (pin power_in line (at 5.08 2.54 180) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27))))
    )
  )
)
`

test("parseKicadSymToSchematicMetadata extracts pin labels and port arrangement", () => {
  const result = parseKicadSymToSchematicMetadata(simpleKicadSym)
  expect(result).toEqual({
    pinLabels: {
      pin1: "VBUS",
      pin2: "D+",
      pin3: "D-",
      pin4: "GND",
    },
    schPinArrangement: {
      leftSide: {
        pins: ["pin1", "pin2"],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: ["pin3", "pin4"],
        direction: "bottom-to-top",
      },
    },
    circuitJsonPortArrangement: {
      left_side: {
        pins: ["pin1", "pin2"],
        direction: "top-to-bottom",
      },
      right_side: {
        pins: ["pin3", "pin4"],
        direction: "bottom-to-top",
      },
    },
  })
})

test("parseKicadSymToSchematicMetadata returns null for empty input", () => {
  const empty = `(kicad_symbol_lib (version 20231120) (generator "test"))`
  expect(parseKicadSymToSchematicMetadata(empty)).toBeNull()
})

test("parseKicadSymToSchematicMetadata handles tilde pin names", () => {
  const tildeInput = `
(kicad_symbol_lib
  (version 20231120)
  (generator "test")
  (symbol "Test:IC"
    (pin input line (at -5.08 0 0) (length 2.54)
      (name "~" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
  )
)
`
  const result = parseKicadSymToSchematicMetadata(tildeInput)
  expect(result?.pinLabels.pin1).toBe("1")
})

test("applyKicadSymMetadataToCircuitJson enriches circuit json elements", () => {
  const metadata = parseKicadSymToSchematicMetadata(simpleKicadSym)
  const circuitJson = [
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_0",
      source_component_id: "source_component_0",
    },
    {
      type: "source_port",
      source_port_id: "source_port_0",
      source_component_id: "source_component_0",
      name: "1",
      pin_number: 1,
      pin_label: "pin1",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_0",
      source_port_id: "source_port_0",
      schematic_component_id: "schematic_component_0",
    },
  ]

  const enriched = applyKicadSymMetadataToCircuitJson(circuitJson, metadata)
  expect(enriched).toMatchObject([
    {
      type: "schematic_component",
      port_labels: { pin1: "VBUS", pin2: "D+", pin3: "D-", pin4: "GND" },
      port_arrangement: {
        left_side: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
        right_side: { pins: ["pin3", "pin4"], direction: "bottom-to-top" },
      },
    },
    {
      type: "source_port",
      pin_label: "VBUS",
    },
    {
      type: "schematic_port",
      display_pin_label: "VBUS",
    },
  ])
})

test("applyKicadSymMetadataToCircuitJson with null metadata returns unchanged array", () => {
  const input = [{ type: "source_port", source_port_id: "x" }]
  const result = applyKicadSymMetadataToCircuitJson(input, null)
  expect(result).toEqual(input)
})
