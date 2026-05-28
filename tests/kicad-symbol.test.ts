import { expect, test } from "bun:test"
import { parseKicadModToCircuitJson, parseKicadSymToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const simpleSymbol = `
(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Test:DirectionalPart"
    (pin passive line (at -5.08 -2.54 0) (length 2.54)
      (name "GND") (number "1"))
    (pin input line (at 5.08 -2.54 180) (length 2.54)
      (name "VIN") (number "2"))
    (pin output line (at 0 -5.08 90) (length 2.54)
      (name "OUT") (number "3"))
    (pin passive line (at 0 5.08 270) (length 2.54)
      (name "EN") (number "4"))
  )
)
`

test("parses kicad_sym into schematic port arrangement and labels", async () => {
  const circuitJson = (await parseKicadSymToCircuitJson(simpleSymbol)) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.port_arrangement).toEqual({
    left_side: { pins: [1] },
    right_side: { pins: [2] },
    bottom_side: { pins: [3] },
    top_side: { pins: [4] },
  })
  expect(schematicComponent.port_labels).toEqual({
    "1": "GND",
    "2": "VIN",
    "3": "OUT",
    "4": "EN",
  })

  const sourcePort = circuitJson.find(
    (element) => element.type === "source_port" && element.name === "2",
  )
  expect(sourcePort.pin_label).toBe("VIN")
  expect(sourcePort.port_hints).toEqual(["pin2", "VIN"])
})

test("kicad_sym enriches kicad_mod schematic metadata", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "JST_XH_B3B-XH-AM_1x03_P2.50mm_Vertical.kicad_mod",
  )
  const circuitJson = (await parseKicadModToCircuitJson(
    fileContent,
    simpleSymbol,
  )) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.port_labels["1"]).toBe("GND")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1])
})
