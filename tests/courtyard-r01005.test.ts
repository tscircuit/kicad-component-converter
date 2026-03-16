import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("R_01005_0402Metric - F.CrtYd rectangular fp_lines produce a courtyard rect", async () => {
  const fileContent = fs
    .readFileSync(
      join(import.meta.dirname, "data/R_01005_0402Metric.kicad_mod"),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Rectangular courtyard from fp_lines should be promoted to pcb_courtyard_rect
  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBe(1)
  expect((courtyardRects[0] as any).layer).toBe("top")
  expect((courtyardRects[0] as any).width).toBeCloseTo(1.2)
  expect((courtyardRects[0] as any).height).toBeCloseTo(0.6)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
