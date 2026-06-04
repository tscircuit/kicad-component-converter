import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson, parseKicadSymToSymbolMetadata } from "src"

const testFootprint = `(footprint "Test:DIP_4"
  (version 20240108)
  (generator "pcbnew")
  (layer "F.Cu")
  (pad "1" thru_hole rect (at -3.81 -2.54) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask"))
  (pad "2" thru_hole circle (at -3.81 2.54) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask"))
  (pad "3" thru_hole circle (at 3.81 2.54) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask"))
  (pad "4" thru_hole circle (at 3.81 -2.54) (size 1.6 1.6) (drill 0.8) (layers "*.Cu" "*.Mask"))
)`

const testSymbol = `(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Device:TEST4"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "VCC" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin input line (at -5.08 -2.54 0) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin output line (at 5.08 -2.54 180) (length 2.54)
      (name "SCL" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "SDA" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27))))
    )
  )
)`

test("parses KiCad symbol pins into metadata", () => {
  const metadata = parseKicadSymToSymbolMetadata(testSymbol)

  expect(metadata.symbolName).toBe("Device:TEST4")
  expect(metadata.pins.map((pin) => pin.number)).toEqual(["1", "2", "3", "4"])
  expect(metadata.pins.map((pin) => pin.name)).toEqual([
    "VCC",
    "GND",
    "SCL",
    "SDA",
  ])
})

test("adds symbol pin labels and schematic port arrangement when kicad_sym is provided", async () => {
  const circuitJson = await parseKicadModToCircuitJson(testFootprint, {
    kicadSym: testSymbol,
  })

  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  ) as any

  expect(schematicComponent.symbol_name).toBe("Device:TEST4")
  expect(schematicComponent.port_labels).toEqual({
    "1": "VCC",
    "2": "GND",
    "3": "SCL",
    "4": "SDA",
  })
  expect(schematicComponent.port_arrangement).toEqual({
    left_side: { pins: ["1", "2"], direction: "top-to-bottom" },
    right_side: { pins: ["4", "3"], direction: "top-to-bottom" },
  })
})
