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

  expect(convertCircuitJsonToPcbSvg(circuitJson as any)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
