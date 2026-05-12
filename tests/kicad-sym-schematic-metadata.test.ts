import { expect, test } from "bun:test"
import {
  applyKicadSymSchematicMetadata,
  convertCircuitJsonToTscircuitWithSchematicMetadata,
  createCircuitJsonFromKicadSymMetadata,
  parseKicadModToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "src"
import fs from "node:fs"
import { join } from "node:path"

const simpleKicadSym = `(kicad_symbol_lib
  (version 20230121)
  (generator kicad_symbol_editor)
  (symbol "Device:MiniChip"
    (symbol "Device:MiniChip_0_1"
      (pin power_in line (at -5.08 1.27 0) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin power_in line (at -5.08 -1.27 0) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 0 180) (length 2.54)
        (name "OUT" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )
)`

test("parses KiCad symbol pins into schematic arrangement and pin labels", () => {
  const [metadata] = parseKicadSymToSchematicMetadata(simpleKicadSym)

  expect(metadata.symbolName).toBe("Device:MiniChip")
  expect(metadata.schPortArrangement).toEqual({
    leftSide: { pins: [1, 2], direction: "top-to-bottom" },
    rightSide: { pins: [3], direction: "top-to-bottom" },
  })
  expect(metadata.portArrangement).toEqual({
    left_side: { pins: [1, 2], direction: "top-to-bottom" },
    right_side: { pins: [3], direction: "top-to-bottom" },
  })
  expect(metadata.pinLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "OUT",
  })
})

test("creates symbol-only circuit json and tscircuit code from kicad_sym", () => {
  const [metadata] = parseKicadSymToSchematicMetadata(simpleKicadSym)
  const circuitJson = createCircuitJsonFromKicadSymMetadata(metadata)
  const schematicComponent = circuitJson.find(
    (element: any) => element.type === "schematic_component",
  ) as any

  expect(schematicComponent.port_arrangement).toEqual(metadata.portArrangement)
  expect(schematicComponent.port_labels).toEqual(metadata.portLabels)

  const tscircuitCode = convertCircuitJsonToTscircuitWithSchematicMetadata(
    circuitJson,
    { componentName: "MyComponent", schematicMetadata: metadata },
  )

  expect(tscircuitCode).toContain("const pinLabels =")
  expect(tscircuitCode).toContain("const schPortArrangement =")
  expect(tscircuitCode).toContain("pinLabels={pinLabels}")
  expect(tscircuitCode).toContain("schPortArrangement={schPortArrangement}")
})

test("applies kicad_sym schematic metadata to a parsed kicad_mod footprint", async () => {
  const footprint = fs.readFileSync(
    join(
      import.meta.dirname,
      "fixtures/kicad-footprints/Connector_JST.pretty/JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
    ),
    "utf8",
  )
  const [metadata] = parseKicadSymToSchematicMetadata(simpleKicadSym)
  const circuitJson = applyKicadSymSchematicMetadata(
    await parseKicadModToCircuitJson(footprint),
    metadata,
  )
  const schematicComponent = circuitJson.find(
    (element: any) => element.type === "schematic_component",
  ) as any
  const schematicPorts = circuitJson.filter(
    (element: any) => element.type === "schematic_port",
  ) as any[]

  expect(schematicComponent.port_arrangement).toEqual(metadata.portArrangement)
  expect(schematicComponent.port_labels).toEqual(metadata.portLabels)
  expect(schematicPorts.find((port) => port.pin_number === 1)).toMatchObject({
    display_pin_label: "VCC",
    side_of_component: "left",
  })
  expect(schematicPorts.find((port) => port.pin_number === 2)).toMatchObject({
    display_pin_label: "GND",
    side_of_component: "left",
  })
})
