import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { parseKicadModToCircuitJson, parseKicadSymToSchematicInfo } from "src"

test("parse resistor kicad_sym - 2 pin passive", () => {
  const content = fs.readFileSync(
    join(import.meta.dirname, "data/R.kicad_sym"),
    "utf8",
  )
  const info = parseKicadSymToSchematicInfo(content)

  // Resistor has 2 pins with name "~" (hidden), so pinLabels should be empty
  expect(Object.keys(info.pinLabels).length).toBe(0)

  // Pin 1 has rotation 270 -> top side, Pin 2 has rotation 90 -> bottom side
  expect(info.schPinArrangement.top_side?.pins).toContain(1)
  expect(info.schPinArrangement.bottom_side?.pins).toContain(2)
})

test("parse ATmega328P kicad_sym - multi-pin IC", () => {
  const content = fs.readFileSync(
    join(import.meta.dirname, "data/ATmega328P.kicad_sym"),
    "utf8",
  )
  const info = parseKicadSymToSchematicInfo(content)

  // Should have pin labels for all named pins
  expect(info.pinLabels.pin7).toBe("VCC")
  expect(info.pinLabels.pin8).toBe("GND")
  expect(info.pinLabels.pin1).toBe("~{RESET}")
  expect(info.pinLabels.pin14).toBe("PB0")
  expect(info.pinLabels.pin23).toBe("PC0")

  // Left side: power pins + inputs (rotation 0)
  expect(info.schPinArrangement.left_side).toBeDefined()
  expect(info.schPinArrangement.left_side!.pins).toContain(7) // VCC
  expect(info.schPinArrangement.left_side!.pins).toContain(8) // GND
  expect(info.schPinArrangement.left_side!.pins).toContain(1) // RESET

  // Right side: port pins (rotation 180)
  expect(info.schPinArrangement.right_side).toBeDefined()
  expect(info.schPinArrangement.right_side!.pins).toContain(14) // PB0
  expect(info.schPinArrangement.right_side!.pins).toContain(2) // PD0
})

test("parse kicad_sym with invalid content throws", () => {
  expect(() => parseKicadSymToSchematicInfo("(footprint test)")).toThrow(
    "Invalid kicad_sym file",
  )
})

test("kicad_sym enriches schematic_component in circuit JSON", async () => {
  // Use a simple kicad_mod fixture to test enrichment
  const kicadMod = fs.readFileSync(
    join(import.meta.dirname, "data/R_01005_0402Metric.kicad_mod"),
    "utf8",
  )
  const kicadSym = fs.readFileSync(
    join(import.meta.dirname, "data/R.kicad_sym"),
    "utf8",
  )

  // Without kicad_sym
  const circuitJsonBase = await parseKicadModToCircuitJson(kicadMod)
  const schComponentBase = (circuitJsonBase as any[]).find(
    (e: any) => e.type === "schematic_component",
  )
  expect(schComponentBase.port_arrangement).toBeUndefined()

  // With kicad_sym
  const circuitJsonEnriched = await parseKicadModToCircuitJson(
    kicadMod,
    kicadSym,
  )
  const schComponent = (circuitJsonEnriched as any[]).find(
    (e: any) => e.type === "schematic_component",
  )
  expect(schComponent.port_arrangement).toBeDefined()
  expect(schComponent.port_arrangement.top_side?.pins).toContain(1)
  expect(schComponent.port_arrangement.bottom_side?.pins).toContain(2)

  // Generate schematic SVG snapshot to verify visual output
  expect(
    convertCircuitJsonToSchematicSvg(circuitJsonEnriched as any),
  ).toMatchSvgSnapshot(import.meta.path)
})
