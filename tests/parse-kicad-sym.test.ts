import { expect, test } from "bun:test"
import {
  parseKicadModToCircuitJson,
  parseKicadSymToSchematicMetadata,
} from "src"

const FOUR_PIN_SYM = `
(kicad_symbol_lib
  (version 20231120)
  (generator "kicad_symbol_editor")
  (symbol "Test:FourPin"
    (symbol "FourPin_0_1"
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

const FOUR_PIN_MOD = `
(footprint "FourPin"
  (version 20240108)
  (generator "pcbnew")
  (layer "F.Cu")
  (property "Reference" "U" (at 0 0 0) (layer "F.SilkS"))
  (property "Value" "FourPin" (at 0 0 0) (layer "F.Fab"))
  (pad "1" smd rect (at -1.5 1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "2" smd rect (at -1.5 -1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "3" smd rect (at 1.5 1.5 0) (size 1 1) (layers "F.Cu"))
  (pad "4" smd rect (at 1.5 -1.5 0) (size 1 1) (layers "F.Cu"))
)
`

test("parseKicadSymToSchematicMetadata returns pin labels and side arrangement", () => {
  const { pinLabels, schPortArrangement } =
    parseKicadSymToSchematicMetadata(FOUR_PIN_SYM)

  expect(pinLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "SDA",
    pin4: "SCL",
  })

  expect(schPortArrangement.leftSide?.pins).toEqual(["pin1", "pin2"])
  expect(schPortArrangement.leftSide?.direction).toBe("top-to-bottom")
  expect(schPortArrangement.rightSide?.pins).toEqual(["pin3", "pin4"])
  expect(schPortArrangement.rightSide?.direction).toBe("top-to-bottom")
})

test("parseKicadModToCircuitJson enriches source_component with kicad_sym metadata", async () => {
  const circuitJson = await parseKicadModToCircuitJson(FOUR_PIN_MOD, {
    kicadSym: FOUR_PIN_SYM,
  })

  const src = circuitJson.find((el) => el.type === "source_component") as any
  expect(src).toBeDefined()
  expect(src.pinLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "SDA",
    pin4: "SCL",
  })
  expect(src.schPortArrangement?.leftSide?.pins).toEqual(["pin1", "pin2"])
  expect(src.schPortArrangement?.rightSide?.pins).toEqual(["pin3", "pin4"])
})

test("parseKicadModToCircuitJson without kicadSym leaves metadata absent", async () => {
  const circuitJson = await parseKicadModToCircuitJson(FOUR_PIN_MOD)
  const src = circuitJson.find((el) => el.type === "source_component") as any
  expect(src).toBeDefined()
  expect(src.pinLabels).toBeUndefined()
  expect(src.schPortArrangement).toBeUndefined()
})

test("parseKicadSymToSchematicMetadata ignores no_connect pins", () => {
  const symWithNoConnect = `
(kicad_symbol_lib
  (version 20231120)
  (symbol "Test:TwoPlusHidden"
    (symbol "TwoPlusHidden_0_1"
      (pin input line (at -5.08 2.54 0) (length 2.54)
        (name "A" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin no_connect line (at -5.08 0 0) (length 2.54)
        (name "NC" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin output line (at 5.08 2.54 180) (length 2.54)
        (name "B" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )
)
  `
  const { pinLabels } = parseKicadSymToSchematicMetadata(symWithNoConnect)
  expect(Object.keys(pinLabels)).not.toContain("pin2")
  expect(pinLabels.pin1).toBe("A")
  expect(pinLabels.pin3).toBe("B")
})

test("parseKicadSymToSchematicMetadata handles top/bottom pins", () => {
  const symTopBottom = `
(kicad_symbol_lib
  (version 20231120)
  (symbol "Test:TopBottom"
    (symbol "TopBottom_0_1"
      (pin input line (at 0 5.08 270) (length 2.54)
        (name "TOP1" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin input line (at 2.54 5.08 270) (length 2.54)
        (name "TOP2" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin output line (at 0 -5.08 90) (length 2.54)
        (name "BOT1" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )
)
  `
  const { schPortArrangement } = parseKicadSymToSchematicMetadata(symTopBottom)
  expect(schPortArrangement.topSide?.pins).toEqual(["pin1", "pin2"])
  expect(schPortArrangement.topSide?.direction).toBe("left-to-right")
  expect(schPortArrangement.bottomSide?.pins).toEqual(["pin3"])
})
