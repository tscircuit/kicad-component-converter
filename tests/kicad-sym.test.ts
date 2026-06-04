import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseKicadModToCircuitJson, parseKicadSymToCircuitJson } from "src"
import { convertKicadCircuitJsonToTscircuit } from "src/convert-circuit-json-to-tscircuit"

const symbolFixture = readFileSync(
  join(import.meta.dirname, "data", "simple-symbol.kicad_sym"),
  "utf-8",
)

test("parses kicad_sym pins into schematic arrangement and labels", async () => {
  const circuitJson = await parseKicadSymToCircuitJson(symbolFixture)
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  ) as any
  const sourcePorts = circuitJson.filter((elm) => elm.type === "source_port")

  expect(schematicComponent.port_arrangement).toEqual({
    left_side: { pins: [1] },
    right_side: { pins: [2] },
    top_side: { pins: [3] },
    bottom_side: { pins: [4] },
  })
  expect(schematicComponent.port_labels).toEqual({
    "1": "VIN",
    "2": "VOUT",
    "3": "VCC",
    "4": "GND",
  })
  expect(sourcePorts).toHaveLength(4)
  expect(sourcePorts.map((port: any) => port.pin_label)).toEqual([
    "VIN",
    "VOUT",
    "VCC",
    "GND",
  ])
})

test("enriches kicad_mod conversion with kicad_sym schematic metadata", async () => {
  const kicadMod = readFileSync(
    join(import.meta.dirname, "fixtures", "SimpleSmd.kicad_mod"),
    "utf-8",
  )
  const circuitJson = await parseKicadModToCircuitJson(kicadMod, {
    kicadSym: symbolFixture,
  })
  const schematicComponent = circuitJson.find(
    (elm) => elm.type === "schematic_component",
  ) as any
  const pinOne = circuitJson.find(
    (elm) => elm.type === "source_port" && (elm as any).name === "1",
  ) as any

  expect(schematicComponent.port_labels["1"]).toBe("VIN")
  expect(schematicComponent.port_arrangement.left_side.pins).toEqual([1])
  expect(pinOne.pin_label).toBe("VIN")
  expect(pinOne.port_hints).toContain("VIN")
})

test("generates tscircuit code with symbol pin labels and schematic arrangement", async () => {
  const circuitJson = await parseKicadSymToCircuitJson(symbolFixture)
  const tscircuitCode = convertKicadCircuitJsonToTscircuit(circuitJson, {
    componentName: "MyComponent",
  })

  expect(tscircuitCode).toContain("const pinLabels")
  expect(tscircuitCode).toContain('"1": "VIN"')
  expect(tscircuitCode).toContain("pinLabels={pinLabels}")
  expect(tscircuitCode).toContain("schPortArrangement={{")
  expect(tscircuitCode).toContain('"leftSide"')
  expect(tscircuitCode).toContain('"rightSide"')
  expect(tscircuitCode).toContain('"topSide"')
  expect(tscircuitCode).toContain('"bottomSide"')
})
