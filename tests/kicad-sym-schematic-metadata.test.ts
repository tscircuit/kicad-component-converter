import { expect, test } from "bun:test"
import {
  parseKicadModToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "src"

const kicadMod = `(footprint "Issue114Part"
  (version 20240101)
  (generator "issue-114-test")
  (layer "F.Cu")
  (pad "1" smd rect (at -1 1) (size 0.5 0.5) (layers "F.Cu"))
  (pad "2" smd rect (at 1 0) (size 0.5 0.5) (layers "F.Cu"))
  (pad "3" smd rect (at 0 1) (size 0.5 0.5) (layers "F.Cu"))
  (pad "4" smd rect (at 0 -1) (size 0.5 0.5) (layers "F.Cu"))
  (pad "5" smd rect (at -1 -1) (size 0.5 0.5) (layers "F.Cu"))
)`

const kicadSym = `(kicad_symbol_lib
  (version 20240101)
  (generator "issue-114-test")
  (symbol "Issue114Part"
    (property "Reference" "U" (at 0 6.35 0)
      (effects (font (size 1.27 1.27))))
    (symbol "Issue114Part_0_1"
      (pin input line (at -5.08 2.54 0) (length 2.54)
        (name "VIN" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin input line (at -5.08 -2.54 0) (length 2.54)
        (name "EN" (effects (font (size 1.27 1.27))))
        (number "5" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 0 180) (length 2.54)
        (name "OUT" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))))
    (symbol "Issue114Part_1_1"
      (pin power_in line (at -1.27 5.08 270) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
      (pin power_in line (at 1.27 -5.08 90) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "4" (effects (font (size 1.27 1.27))))))
  )
)`

test("parses nested .kicad_sym pins into labels and port arrangement", () => {
  const metadata = parseKicadSymToSchematicMetadata(kicadSym)

  expect(metadata?.pinLabels).toEqual({
    "1": "VIN",
    "2": "OUT",
    "3": "VCC",
    "4": "GND",
    "5": "EN",
  })
  expect(metadata?.portArrangement).toEqual({
    left_side: { pins: [1, 5], direction: "top-to-bottom" },
    right_side: { pins: [2], direction: "top-to-bottom" },
    top_side: { pins: [3], direction: "left-to-right" },
    bottom_side: { pins: [4], direction: "left-to-right" },
  })
  expect(metadata?.pins.find((pin) => pin.number === "1")?.side).toBe("left")
  expect(metadata?.pins.find((pin) => pin.number === "4")?.side).toBe("bottom")
})

test("wires optional .kicad_sym metadata into converted circuit json", async () => {
  const circuitJson = (await parseKicadModToCircuitJson(
    kicadMod,
    kicadSym,
  )) as any[]
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  )
  const sourcePorts = circuitJson.filter((elm) => elm.type === "source_port")
  const schematicPorts = circuitJson.filter(
    (elm) => elm.type === "schematic_port",
  )
  const sourcePort1 = sourcePorts.find((port) => port.name === "1")
  const schematicPort1 = schematicPorts.find(
    (port) => port.source_port_id === sourcePort1.source_port_id,
  )

  expect(schematicComponent.port_arrangement).toEqual({
    left_side: { pins: [1, 5], direction: "top-to-bottom" },
    right_side: { pins: [2], direction: "top-to-bottom" },
    top_side: { pins: [3], direction: "left-to-right" },
    bottom_side: { pins: [4], direction: "left-to-right" },
  })
  expect(schematicComponent.port_labels).toEqual({
    "1": "VIN",
    "2": "OUT",
    "3": "VCC",
    "4": "GND",
    "5": "EN",
  })
  expect(sourcePort1.pin_label).toBe("VIN")
  expect(sourcePort1.port_hints).toEqual(["VIN", "pin1", "1"])
  expect(schematicPort1.display_pin_label).toBe("VIN")
  expect(schematicPort1.side_of_component).toBe("left")
  expect(schematicPort1.facing_direction).toBe("left")
  expect(schematicPort1.center.x).toBeLessThan(0)
})

test("footprint-only conversion keeps existing schematic fallback", async () => {
  const circuitJson = (await parseKicadModToCircuitJson(kicadMod)) as any[]
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  )
  const sourcePort1 = circuitJson.find(
    (elm) => elm.type === "source_port" && elm.name === "1",
  )
  const schematicPort1 = circuitJson.find(
    (elm) =>
      elm.type === "schematic_port" &&
      elm.source_port_id === sourcePort1.source_port_id,
  )

  expect(schematicComponent.port_arrangement).toBeUndefined()
  expect(schematicComponent.port_labels).toBeUndefined()
  expect(sourcePort1.pin_label).toBe("pin1")
  expect(sourcePort1.port_hints).toEqual(["1"])
  expect(schematicPort1.center).toEqual({ x: 0, y: 0 })
  expect(schematicPort1.display_pin_label).toBeUndefined()
})
