import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("pads and poly trace", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/SOP-20_7.5x12.8mm_P1.27mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
