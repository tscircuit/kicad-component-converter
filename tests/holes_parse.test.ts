import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("plated hole FP", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
