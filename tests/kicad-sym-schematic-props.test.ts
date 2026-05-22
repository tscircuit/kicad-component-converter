import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { parseKicadModToCircuitJson, parseKicadSymToSchematicProps } from "src"

const kicadSym = `(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Demo:Demo"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "VIN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "VOUT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 0 -5.08 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
  )
)`

const fourSidedKicadSym = `(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Demo:FourSided"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "VIN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin input line (at -5.08 -2.54 0) (length 2.54)
      (name "EN" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27))))
    )
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "VOUT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 0 -5.08 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
    (pin input line (at 0 5.08 270) (length 2.54)
      (name "CLK" (effects (font (size 1.27 1.27))))
      (number "5" (effects (font (size 1.27 1.27))))
    )
  )
)`

test("extracts schematic arrangement and labels from kicad_sym pins", () => {
  const props = parseKicadSymToSchematicProps(kicadSym)

  expect(props.schPortArrangement.left_side).toEqual({
    pins: [1],
    direction: "top-to-bottom",
  })
  expect(props.schPortArrangement.right_side).toEqual({
    pins: [2],
    direction: "top-to-bottom",
  })
  expect(props.schPortArrangement.bottom_side).toEqual({
    pins: [3],
    direction: "left-to-right",
  })
  expect(props.pinLabels).toEqual({ 1: "VIN", 2: "VOUT", 3: "GND" })
})

test("sorts symbol pins by side using schematic orientation", () => {
  const props = parseKicadSymToSchematicProps(fourSidedKicadSym)

  expect(props.schPortArrangement.left_side).toEqual({
    pins: [1, 4],
    direction: "top-to-bottom",
  })
  expect(props.schPortArrangement.right_side?.pins).toEqual([2])
  expect(props.schPortArrangement.bottom_side).toEqual({
    pins: [3],
    direction: "left-to-right",
  })
  expect(props.schPortArrangement.top_side).toEqual({
    pins: [5],
    direction: "left-to-right",
  })
  expect(props.pinLabels).toEqual({
    1: "VIN",
    2: "VOUT",
    3: "GND",
    4: "EN",
    5: "CLK",
  })
})

test("applies kicad_sym schematic props to the schematic component", async () => {
  const fileContent = fs.readFileSync(
    join(import.meta.dirname, "fixtures/SimpleSmd.kicad_mod"),
    "utf8",
  )
  const props = parseKicadSymToSchematicProps(kicadSym)
  const circuitJson = (await parseKicadModToCircuitJson(
    fileContent,
    props,
  )) as any[]

  const schematicComponent = circuitJson.find(
    (el) => el.type === "schematic_component",
  )

  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1])
  expect(schematicComponent.port_labels).toEqual({
    1: "VIN",
    2: "VOUT",
    3: "GND",
  })
})
