import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import {
  parseKicadComponentToCircuitJson,
  parseKicadModToCircuitJson,
  parseKicadSymToCircuitJson,
  parseKicadSymToSchematicFields,
} from "src"

const symFixturePath = join(import.meta.dirname, "data/simple-opamp.kicad_sym")
const modFixturePath = join(
  import.meta.dirname,
  "data/R_01005_0402Metric.kicad_mod",
)

test("parses kicad_sym pins into schematic arrangement and labels", () => {
  const kicadSym = fs.readFileSync(symFixturePath, "utf8")
  const fields = parseKicadSymToSchematicFields(kicadSym)

  expect(fields.port_arrangement).toEqual({
    left_side: { pins: [1, 2], direction: "top-to-bottom" },
    right_side: { pins: [3], direction: "top-to-bottom" },
    top_side: { pins: [4], direction: "left-to-right" },
    bottom_side: { pins: [5], direction: "left-to-right" },
  })
  expect(fields.port_labels).toEqual({
    "1": "IN+",
    "2": "IN-",
    "3": "OUT",
    "4": "VCC",
    "5": "GND",
  })
})

test("can produce schematic-only circuit json from kicad_sym", async () => {
  const kicadSym = fs.readFileSync(symFixturePath, "utf8")
  const circuitJson = parseKicadSymToCircuitJson(kicadSym) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port",
  )

  expect(schematicComponent.port_labels["3"]).toBe("OUT")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1, 2])
  expect(sourcePorts.map((port) => port.pin_label)).toContain("VCC")
})

test("kicad_sym enriches footprint circuit json with schematic labels", async () => {
  const kicadMod = fs.readFileSync(modFixturePath, "utf8")
  const kicadSym = fs.readFileSync(symFixturePath, "utf8")
  const circuitJson = (await parseKicadModToCircuitJson(kicadMod, {
    kicadSym,
  })) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )

  expect(schematicComponent.port_labels["1"]).toBe("IN+")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1, 2])
})

test("component parser accepts symbol-only input", async () => {
  const kicadSym = fs.readFileSync(symFixturePath, "utf8")
  const circuitJson = (await parseKicadComponentToCircuitJson({
    kicadSym,
  })) as any[]

  expect(circuitJson.some((element) => element.type === "pcb_component")).toBe(
    false,
  )
  expect(
    circuitJson.some((element) => element.type === "schematic_component"),
  ).toBe(true)
})
