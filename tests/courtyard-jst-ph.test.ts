import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("JST_PH_B2B-PH-K - F.CrtYd fp_lines form a courtyard outline", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
  )

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_outline",
  )
  expect(courtyards.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
