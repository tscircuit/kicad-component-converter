import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import {
  parseKicadModToCircuitJson,
  parseKicadSymToCircuitJson,
  parseKicadSymToMetadata,
} from "src"

const symbolFixturePath = join(
  import.meta.dirname,
  "fixtures/SimpleSymbol.kicad_sym",
)
const simpleSmdFixturePath = join(
  import.meta.dirname,
  "fixtures/SimpleSmd.kicad_mod",
)

const loadSymbol = () => fs.readFileSync(symbolFixturePath, "utf8")

test("parses kicad_sym pins into labels and schematic port arrangement", () => {
  const metadata = parseKicadSymToMetadata(loadSymbol())

  expect(metadata.portLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "IO",
    pin4: "BOOT",
    pin5: "RESET",
  })
  expect(metadata.portArrangement).toEqual({
    left_side: { pins: [1, 2], direction: "top-to-bottom" },
    right_side: { pins: [3], direction: "top-to-bottom" },
    top_side: { pins: [5], direction: "left-to-right" },
    bottom_side: { pins: [4], direction: "left-to-right" },
  })
})

test("can convert a symbol-only kicad_sym into schematic circuit json", () => {
  const circuitJson = parseKicadSymToCircuitJson(loadSymbol()) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )
  const sourcePort1 = circuitJson.find(
    (element) => element.type === "source_port" && element.name === "1",
  )

  expect(schematicComponent.port_labels.pin1).toBe("VCC")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1, 2])
  expect(sourcePort1.port_hints).toEqual(["pin1", "1", "VCC"])
  expect(sourcePort1.pin_number).toBe(1)
})

test("uses optional kicad_sym metadata to enrich footprint conversion", async () => {
  const kicadMod = fs.readFileSync(simpleSmdFixturePath, "utf8")
  const circuitJson = (await parseKicadModToCircuitJson(kicadMod, {
    kicadSym: loadSymbol(),
  })) as any[]

  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )
  const sourcePort1 = circuitJson.find(
    (element) => element.type === "source_port" && element.name === "1",
  )
  const smtPad = circuitJson.find((element) => element.type === "pcb_smtpad")

  expect(schematicComponent.port_labels.pin1).toBe("VCC")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1])
  expect(sourcePort1.port_hints).toContain("VCC")
  expect(sourcePort1.pin_label).toBe("pin1")
  expect(smtPad.port_hints).toContain("VCC")
})
