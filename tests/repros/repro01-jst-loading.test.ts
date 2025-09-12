import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "node:fs"
import { join } from "node:path"

test("jst loading issue with pin numbers", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "../../kicad-footprints/Connector_JST.pretty/JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Log pcb_plated_holes for inspection
  const platedHoles = circuitJson.filter((element: any) => element.type === "pcb_plated_hole")
  console.log("PCB plated holes:", JSON.stringify(platedHoles, null, 2))

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
