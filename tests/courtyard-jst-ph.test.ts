import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("JST_PH_B2B-PH-K - F.CrtYd fp_lines produce courtyard elements", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
  )

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Accept either pcb_courtyard_rect (if rectangular) or pcb_courtyard_outline
  const courtyards = circuitJson.filter(
    (el: any) =>
      el.type === "pcb_courtyard_rect" || el.type === "pcb_courtyard_outline",
  )
  expect(courtyards.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
