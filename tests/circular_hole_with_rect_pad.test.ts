import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "node:fs"
import { join } from "path"

test("ADOM_Capacitor_Chip.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/adom_capacitor_chip.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  Bun.write("circuit-json.json", JSON.stringify(circuitJson, null, 2))
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
