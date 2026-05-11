import { expect, test } from "bun:test"
import {
  parseKicadModToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "src"

const kicadMod = `(footprint "Demo:Connector"
  (version 20240108)
  (generator "test")
  (layer "F.Cu")
  (fp_text reference "J1" (at 0 0 0) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))
  (pad "1" smd rect (at -1 0 0) (size 1 1) (layers "F.Cu"))
  (pad "2" smd rect (at 1 0 0) (size 1 1) (layers "F.Cu"))
  (pad "3" smd rect (at 0 1 0) (size 1 1) (layers "F.Cu"))
)`

const kicadSym = `(kicad_symbol_lib
  (version 20231120)
  (generator "test")
  (symbol "Demo_Connector"
    (property "Reference" "J" (at 0 0 0))
    (symbol "Demo_Connector_0_1"
      (pin passive line (at -5 2.54 0) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 5 0 180) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -5 90) (length 2.54)
        (name "IO" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )
)`

test("parses kicad_sym pins into schematic metadata", () => {
  expect(parseKicadSymToSchematicMetadata(kicadSym)).toEqual({
    port_arrangement: {
      left_side: { pins: [1], direction: "top-to-bottom" },
      right_side: { pins: [2], direction: "top-to-bottom" },
      bottom_side: { pins: [3], direction: "left-to-right" },
    },
    port_labels: {
      "1": "VCC",
      "2": "GND",
      "3": "IO",
    },
  })
})

test("adds optional kicad_sym schematic arrangement and labels", async () => {
  const circuitJson = (await parseKicadModToCircuitJson(kicadMod, {
    kicadSym,
  })) as any[]
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  )
  const sourcePort1 = circuitJson.find(
    (elm) => elm.type === "source_port" && elm.name === "1",
  )

  expect(schematicComponent.port_arrangement).toEqual({
    left_side: { pins: [1], direction: "top-to-bottom" },
    right_side: { pins: [2], direction: "top-to-bottom" },
    bottom_side: { pins: [3], direction: "left-to-right" },
  })
  expect(schematicComponent.port_labels).toEqual({
    "1": "VCC",
    "2": "GND",
    "3": "IO",
  })
  expect(sourcePort1.pin_label).toBe("VCC")
  expect(sourcePort1.port_hints).toEqual(["1", "VCC"])
})

test("keeps footprint-only schematic output unchanged", async () => {
  const circuitJson = (await parseKicadModToCircuitJson(kicadMod)) as any[]
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  )
  const sourcePort1 = circuitJson.find(
    (elm) => elm.type === "source_port" && elm.name === "1",
  )

  expect(schematicComponent.port_arrangement).toBeUndefined()
  expect(schematicComponent.port_labels).toBeUndefined()
  expect(sourcePort1.pin_label).toBe("pin1")
  expect(sourcePort1.port_hints).toEqual(["1"])
})
