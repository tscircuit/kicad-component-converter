import { test, expect } from "bun:test"
import { parseKicadSymToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("a555timer.kicad_sym circuit-json structure", async () => {
  const fixturePath = join(import.meta.dirname, "../data/a555timer.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const parsedSymbols = await parseKicadSymToCircuitJson(fileContent)
  const circuitJson = parsedSymbols[0].circuitJson

  const types = circuitJson.map((el) => el.type)

  // Verify all required element types are present
  expect(types).toContain("source_group")
  expect(types).toContain("source_component")
  expect(types).toContain("schematic_component")
  expect(types).toContain("schematic_group")
  expect(types).toContain("source_port")
  expect(types).toContain("schematic_port")
  expect(types).toContain("schematic_line")
  expect(types).toContain("schematic_text")

  // Verify port count
  const ports = circuitJson.filter((el) => el.type === "schematic_port")
  expect(ports).toHaveLength(8)

  // Verify schematic_text elements don't have schematic_component_id
  const textElements = circuitJson.filter((el) => el.type === "schematic_text")
  expect(textElements.length).toBeGreaterThan(0)
  for (const text of textElements) {
    expect((text as any).schematic_component_id).toBeUndefined()
  }

  // Verify source_component
  const sourceComponent = circuitJson.find(
    (el) => el.type === "source_component",
  )
  expect((sourceComponent as any).name).toBe("A555Timer")
  expect((sourceComponent as any).ftype).toBe("simple_chip")
})
