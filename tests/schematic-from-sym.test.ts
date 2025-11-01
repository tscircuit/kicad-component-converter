import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseKicadModToCircuitJson } from "../src/parse-kicad-mod-to-circuit-json"

test("schematic from sym", async () => {
  const kicad_mod = readFileSync(
    resolve(__dirname, "./data/resistor.kicad_mod"),
    "utf-8",
  )
  const kicad_sym = readFileSync(
    resolve(__dirname, "./data/resistor.kicad_sym"),
    "utf-8",
  )

  const circuitJson = await parseKicadModToCircuitJson(kicad_mod, kicad_sym)

  const schematicComponent = circuitJson.find(
    (c) => c.type === "schematic_component",
  )

  expect(schematicComponent).toBeTruthy()

  expect(schematicComponent?.port_labels).toEqual({
    "1": "A",
    "2": "B",
  })

  expect(schematicComponent?.port_arrangement).toEqual({
    left_side: {
      pins: [1],
    },
    right_side: {
      pins: [2],
    },
  })
})
