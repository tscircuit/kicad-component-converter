import { expect, test } from "bun:test"
import { enhanceCircuitJsonWithKicadSym, parseKicadSymToCircuitJson } from "src"

const SIMPLE_SYM = `(symbol "TestChip"
  (symbol "TestChip_0_1"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "IN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27)))))
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "OUT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27)))))
    (pin power_in line (at 0 -5.08 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27)))))
    (pin power_in line (at 0 5.08 270) (length 2.54)
      (name "VCC" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27)))))
  )
)`

const LIB_SYM = `(kicad_symbol_lib
  (version 20230121)
  (generator kicad_symbol_editor)
  (symbol "Resistor"
    (symbol "Resistor_0_1"
      (pin passive line (at -3.81 0 0) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 3.81 0 180) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
    )
  )
)`

const SYMBOL_WITH_DUPLICATE_UNIT_VARIANTS = `(symbol "MultiVariant"
  (symbol "MultiVariant_0_1"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "A" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27)))))
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "B" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27)))))
  )
  (symbol "MultiVariant_0_2"
    (pin input line (at -5.08 2.54 0) (length 2.54)
      (name "A_ALT" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27)))))
    (pin output line (at 5.08 2.54 180) (length 2.54)
      (name "B_ALT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27)))))
  )
)`

test("parseKicadSymToCircuitJson creates pin arrangement and labels", async () => {
  const circuitJson = (await parseKicadSymToCircuitJson(SIMPLE_SYM)) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.schPortArrangement).toEqual({
    leftSide: ["1"],
    rightSide: ["2"],
    bottomSide: ["3"],
    topSide: ["4"],
  })
  expect(schematicComponent.pinLabels).toEqual({
    "1": "IN",
    "2": "OUT",
    "3": "GND",
    "4": "VCC",
  })
})

test("parseKicadSymToCircuitJson handles kicad_symbol_lib wrappers", async () => {
  const circuitJson = (await parseKicadSymToCircuitJson(LIB_SYM)) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.schPortArrangement).toEqual({
    leftSide: ["1"],
    rightSide: ["2"],
  })
  expect(schematicComponent.pinLabels).toEqual({
    "1": "~",
    "2": "~",
  })
})

test("parseKicadSymToCircuitJson deduplicates pins across symbol variants", async () => {
  const circuitJson = (await parseKicadSymToCircuitJson(
    SYMBOL_WITH_DUPLICATE_UNIT_VARIANTS,
  )) as any[]
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port",
  )
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(sourcePorts.map((port) => port.pin_number)).toEqual([1, 2])
  expect(schematicComponent.schPortArrangement).toEqual({
    leftSide: ["1"],
    rightSide: ["2"],
  })
  expect(schematicComponent.pinLabels).toEqual({
    "1": "A",
    "2": "B",
  })
})

test("enhanceCircuitJsonWithKicadSym adds symbol metadata to mod output", async () => {
  const circuitJson = [
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_0",
      source_component_id: "source_component_0",
    },
    { type: "pcb_component", pcb_component_id: "pcb_component_0" },
  ] as any[]

  const enhanced = (await enhanceCircuitJsonWithKicadSym(
    circuitJson,
    SIMPLE_SYM,
  )) as any[]
  const schematicComponent = enhanced.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.schPortArrangement.leftSide).toEqual(["1"])
  expect(schematicComponent.pinLabels["4"]).toBe("VCC")
  expect(enhanced.find((element) => element.type === "pcb_component")).toBe(
    circuitJson[1],
  )
})
