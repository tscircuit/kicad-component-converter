import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
  )
  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  expect(
    convertCircuitJsonToSchematicSvg(circuitJson as any),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(convertCircuitJsonToPcbSvg(circuitJson as any)).toMatchSvgSnapshot(
    `${import.meta.path}.pcb`,
  )
})
