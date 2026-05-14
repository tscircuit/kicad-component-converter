import { expect, test } from "bun:test"
import {
  parseKicadModToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "src"

const kicadSym = `
(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Test:Four_Pin"
    (symbol "Four_Pin_0_1"
      (pin input line (at -5.08 2.54 0) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin input line (at -5.08 -2.54 0) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 2.54 180) (length 2.54)
        (name "SDA" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 -2.54 180) (length 2.54)
        (name "SCL" (effects (font (size 1.27 1.27))))
        (number "4" (effects (font (size 1.27 1.27)))))
    )
  )
)
`

const kicadMod = `
(footprint "Four_Pin"
  (version 20240108)
  (generator "pcbnew")
  (layer "F.Cu")
  (property "Reference" "U" (at 0 0 0) (layer "F.SilkS"))
  (property "Value" "Four_Pin" (at 0 0 0) (layer "F.Fab"))
  (pad "1" smd rect (at -1.5 1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "2" smd rect (at -1.5 -1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "3" smd rect (at 1.5 1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "4" smd rect (at 1.5 -1.5 0) (size 1 1) (layers "F.Cu"))
)
`

test("parseKicadSymToSchematicMetadata converts symbol pins into labels and side arrangement", () => {
  expect(parseKicadSymToSchematicMetadata(kicadSym)).toEqual({
    pinLabels: {
      pin1: "VCC",
      pin2: "GND",
      pin3: "SDA",
      pin4: "SCL",
    },
    schPortArrangement: {
      leftSide: {
        pins: ["pin1", "pin2"],
        direction: "top-to-bottom",
      },
      rightSide: {
        pins: ["pin3", "pin4"],
        direction: "top-to-bottom",
      },
    },
  })
})

test("parseKicadModToCircuitJson accepts kicadSym metadata", async () => {
  const circuitJson = await parseKicadModToCircuitJson(kicadMod, { kicadSym })
  const sourceComponent = circuitJson.find(
    (element) => element.type === "source_component",
  ) as any

  expect(sourceComponent.pinLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "SDA",
    pin4: "SCL",
  })
  expect(sourceComponent.schPortArrangement.leftSide.pins).toEqual([
    "pin1",
    "pin2",
  ])
  expect(sourceComponent.schPortArrangement.rightSide.pins).toEqual([
    "pin3",
    "pin4",
  ])
})
