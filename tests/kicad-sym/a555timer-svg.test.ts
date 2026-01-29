import { test, expect } from "bun:test"
import { parseKicadSymToCircuitJson } from "src"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("a555timer.kicad_sym schematic svg", async () => {
  const fixturePath = join(import.meta.dirname, "../data/a555timer.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const parsedSymbols = await parseKicadSymToCircuitJson(fileContent)
  const circuitJson = parsedSymbols[0].circuitJson

  const svg = convertCircuitJsonToSchematicSvg(circuitJson as any)
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
