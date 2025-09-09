import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("plated hole FP", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const platedHoles = circuitJson.filter(
    (el: any) => el.type === "pcb_plated_hole",
  )
  expect(platedHoles.length).toBeGreaterThan(0)
})
