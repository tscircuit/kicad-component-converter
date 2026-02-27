import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { parseKicadModToCircuitJson } from "src"

test("pads and poly trace", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/pads-and-poly-trace.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const smtPads = circuitJson.filter((elm) => elm.type === "pcb_smtpad")
  expect(smtPads.length).toBe(3)

  const traces = circuitJson.filter((elm) => elm.type === "pcb_trace")
  expect(traces.length).toBe(0)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
