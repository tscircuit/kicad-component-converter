import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { , convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod", async () => {
  const fileContent = fs.readFileSync(
    join(
      import.meta.dirname,
      "./data/JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
    ),
    "utf-8",
  )

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  expect(
    convertCircuitJsonToSchematicSvg(circuitJson as any),
  ).toMatchSvgSnapshot(import.meta.path)
})
