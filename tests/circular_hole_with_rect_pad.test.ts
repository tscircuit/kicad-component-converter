import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "node:fs"
import { join } from "path"

test("circular_hole_with_rect_pad.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/circular_hole_with_rect_pad.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
