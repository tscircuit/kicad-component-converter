import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { parseKicadModToCircuitJson } from "src"

test("R_01005_0402Metric.kicad_mod - has exactly 2 SMT pads", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const result = await convertCircuitJsonToPcbSvg(circuitJson as any)

  const smtPads = circuitJson.filter((pad: any) => pad.type === "pcb_smtpad")

  expect(smtPads.length).toBe(2)

  expect(result).toMatchSvgSnapshot(import.meta.path)
})
