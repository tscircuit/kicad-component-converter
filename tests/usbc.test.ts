import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("USB_C_Receptacle_CNCTech_C-ARA1-AK51X.kicad_mod", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "USB_C_Receptacle_CNCTech_C-ARA1-AK51X.kicad_mod",
  )

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const svgResult = convertCircuitJsonToPcbSvg(circuitJson as any)

  // Test that the SVG is generated and contains expected elements
  expect(svgResult).toContain("<svg")
  expect(svgResult).toContain('width="800"')
  expect(svgResult).toContain('height="600"')

  // Test that it contains PCB pads (should have multiple pads for USB-C connector)
  const padMatches = svgResult.match(/class="pcb-pad"/g)
  expect(padMatches).toBeTruthy()
  expect(padMatches!.length).toBeGreaterThan(10) // USB-C has many pads

  // Test that it contains holes (USB-C connector has mounting holes)
  expect(svgResult).toContain("pcb-hole-outer")
  expect(svgResult).toContain("pcb-hole-inner")

  // Test that it contains silkscreen elements
  expect(svgResult).toContain("pcb-silkscreen")

  // Test that it contains the component name
  expect(svgResult).toContain("USB_C_Receptacle_CNCTech_C-ARA1-AK51X")
})
