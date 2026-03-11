import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("R_01005_0402Metric - F.CrtYd fp_lines form a courtyard outline", async () => {
  const fileContent = fs
    .readFileSync(
      join(import.meta.dirname, "data/R_01005_0402Metric.kicad_mod"),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_outline",
  )
  expect(courtyards.length).toBe(1)
  expect((courtyards[0] as any).layer).toBe("top")
  expect((courtyards[0] as any).outline.length).toBeGreaterThanOrEqual(3)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
