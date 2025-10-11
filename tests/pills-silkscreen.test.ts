import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "node:fs"
import { join } from "node:path"

test("pills-silkscreen.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/pills-silkscreen.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  Bun.write("pills-silkscreen.json", JSON.stringify(circuitJson, null, 2))
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
