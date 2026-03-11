import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("SMA_Samtec - B.CrtYd fp_lines form a courtyard outline", async () => {
  const fileContent = fs
    .readFileSync(
      join(
        import.meta.dirname,
        "data/SMA_Samtec_SMA-J-P-H-ST-EM1_EdgeMount.kicad_mod",
      ),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyards = circuitJson.filter(
    (el: any) =>
      el.type === "pcb_courtyard_outline" || el.type === "pcb_courtyard_circle",
  )
  expect(courtyards.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
