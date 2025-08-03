import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("Crystal_SMD_HC49-US.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/Crystal_SMD_HC49-US.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const svgResult = convertCircuitJsonToPcbSvg(circuitJson as any)

  // Test that the SVG is generated and contains expected elements
  expect(svgResult).toContain("<svg")
  expect(svgResult).toContain('width="800"')
  expect(svgResult).toContain('height="600"')

  // Test that it contains PCB pads (crystal should have pads)
  const padMatches = svgResult.match(/class="pcb-pad"/g)
  expect(padMatches).toBeTruthy()
  expect(padMatches!.length).toBeGreaterThan(0)

  // Test that it contains component boundary
  expect(svgResult).toContain("pcb-boundary")

  // Test that it contains silkscreen elements
  expect(svgResult).toContain("pcb-silkscreen")
})
