import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("R_01005_0402Metric.kicad_mod - has exactly 2 SMT pads", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const result = await convertCircuitJsonToPcbSvg(circuitJson as any)

  // Assuming result is an object or string that contains SMT pads info,
  // but you want to check SMT pad count in circuitJson (better)

  // Count SMT pads in circuitJson, assuming SMT pads have type "pcb_smtpad"
  const smtPads = circuitJson.filter((pad: any) => pad.type === "pcb_smtpad")

  expect(smtPads.length).toBe(2)

  // You can still do the snapshot test if you want:
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
