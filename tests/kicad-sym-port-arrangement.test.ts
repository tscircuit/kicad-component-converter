import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import {
  parseKicadModToCircuitJson,
  parseKicadSymMetadata,
  parseKicadSymToCircuitJson,
} from "src"

const symbolFixture = `
(kicad_symbol_lib
  (version 20211014)
  (generator "kicad_symbol_editor")
  (symbol "Demo:Ported"
    (pin input line (at -10 10 0) (length 2.54)
      (name "IN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27)))))
    (pin output line (at 10 10 180) (length 2.54)
      (name "OUT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27)))))
    (pin power_in line (at 0 20 270) (length 2.54)
      (name "VCC" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27)))))
    (pin passive line (at 0 -20 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27)))))
  )
)
`

test("kicad_sym metadata maps pins into stable schematic sides", () => {
  const metadata = parseKicadSymMetadata(symbolFixture)

  expect(metadata.port_labels).toEqual({
    1: "IN",
    2: "OUT",
    3: "VCC",
    4: "GND",
  })
  expect(metadata.port_arrangement).toEqual({
    left_side: { pins: [1], direction: "top-to-bottom" },
    right_side: { pins: [2], direction: "top-to-bottom" },
    top_side: { pins: [3], direction: "left-to-right" },
    bottom_side: { pins: [4], direction: "left-to-right" },
  })
})

test("kicad_sym-only input produces schematic ports and labels", async () => {
  const circuitJson = (await parseKicadSymToCircuitJson(symbolFixture)) as any[]
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port",
  )

  expect(schematicComponent?.port_labels).toEqual({
    1: "IN",
    2: "OUT",
    3: "VCC",
    4: "GND",
  })
  expect(schematicComponent?.port_arrangement).toEqual({
    left_side: { pins: [1], direction: "top-to-bottom" },
    right_side: { pins: [2], direction: "top-to-bottom" },
    top_side: { pins: [3], direction: "left-to-right" },
    bottom_side: { pins: [4], direction: "left-to-right" },
  })
  expect(sourcePorts.map((port) => port.pin_label)).toEqual([
    "IN",
    "OUT",
    "VCC",
    "GND",
  ])
})

test("kicad_mod input can be enriched by kicad_sym labels", async () => {
  const footprintPath = join(
    import.meta.dirname,
    "./fixtures/SimpleSmd.kicad_mod",
  )
  const footprint = fs.readFileSync(footprintPath, "utf8")
  const enriched = (await parseKicadModToCircuitJson(
    footprint,
    symbolFixture,
  )) as any[]
  const sourcePort = enriched.find(
    (element) => element.type === "source_port" && element.name === "1",
  )
  const schematicComponent = enriched.find(
    (element) => element.type === "schematic_component",
  )

  expect(sourcePort?.pin_label).toBe("IN")
  expect(sourcePort?.port_hints).toEqual(["1", "IN"])
  expect(schematicComponent?.port_labels?.["1"]).toBe("IN")
})
