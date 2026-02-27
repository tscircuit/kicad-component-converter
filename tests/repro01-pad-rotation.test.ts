import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { parseKicadModToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("repro01-pad-rotation.kicad_mod", async () => {
  const fixture = await getTestFixture()
  const fileContent = await fixture.getKicadFile(
    "SMA_Samtec_SMA-J-P-H-ST-EM1_EdgeMount.kicad_mod",
  )

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  expect(convertCircuitJsonToPcbSvg(circuitJson as any)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
