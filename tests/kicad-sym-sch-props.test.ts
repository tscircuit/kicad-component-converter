import { expect, test } from "bun:test"
import {
  addSchematicPropsToTscircuitCode,
  applyKicadSymPropsToCircuitJson,
  createCircuitJsonFromKicadSymProps,
  parseKicadSymToSchematicProps,
} from "src/parse-kicad-sym-to-sch-props"

const sampleKicadSym = `
(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Test:U2"
    (property "Reference" "U" (at 0 5.08 0))
    (symbol "U2_0_1"
      (pin input line (at -5.08 2.54 0) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 2.54 180) (length 2.54)
        (name "OUT" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -5.08 90) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )
)
`

test("parses KiCad symbol pins into labels and schematic arrangement", () => {
  const props = parseKicadSymToSchematicProps(sampleKicadSym)

  expect(props.pinLabels).toEqual({
    pin1: "VCC",
    pin2: "OUT",
    pin3: "GND",
  })
  expect(props.schPinArrangement).toEqual({
    leftSide: { pins: ["pin1"], direction: "top-to-bottom" },
    rightSide: { pins: ["pin2"], direction: "top-to-bottom" },
    bottomSide: { pins: ["pin3"], direction: "left-to-right" },
  })
})

test("creates schematic circuit json from KiCad symbol pins", () => {
  const props = parseKicadSymToSchematicProps(sampleKicadSym)
  const circuitJson = createCircuitJsonFromKicadSymProps(props) as any[]

  expect(circuitJson.filter((elm) => elm.type === "source_port")).toHaveLength(
    3,
  )
  expect(circuitJson.find((elm) => elm.pin_label === "VCC")).toBeTruthy()
  expect(
    circuitJson.find(
      (elm) =>
        elm.type === "schematic_port" && elm.source_port_id === "source_port_0",
    )?.center,
  ).toEqual({ x: -5.08, y: -2.54 })
})

test("applies KiCad symbol labels to existing circuit json and generated code", () => {
  const props = parseKicadSymToSchematicProps(sampleKicadSym)
  const circuitJson = [
    {
      type: "source_port",
      source_port_id: "source_port_0",
      name: "1",
      port_hints: ["1"],
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_0",
      source_port_id: "source_port_0",
      center: { x: 0, y: 0 },
    },
  ] as any[]

  applyKicadSymPropsToCircuitJson(circuitJson, props)
  expect(circuitJson[0].pin_label).toBe("VCC")
  expect(circuitJson[1].center).toEqual({ x: -5.08, y: -2.54 })

  const code = addSchematicPropsToTscircuitCode(
    `export const MyComponent = (props: ChipProps) => (
  <chip
    {...props}
  />
)`,
    props,
  )
  expect(code).toContain("schPinArrangement")
  expect(code).toContain('"pin1"')
})
