import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("fp_poly with arc segments loads without NaNs", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "..",
    "data",
    "viaGrid-pacman-1.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf-8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
