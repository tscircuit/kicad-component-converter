import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("R_01005_0402Metric.kicad_mod - creates pcb_courtyard_rect from fp_line courtyard", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects.length).toBe(1)
  expect(courtyardRects[0].layer).toBe("top")
  expect(courtyardRects[0].center.x).toBeCloseTo(0, 5)
  expect(courtyardRects[0].center.y).toBeCloseTo(0, 5)
  expect(courtyardRects[0].width).toBeCloseTo(1.2, 5)
  expect(courtyardRects[0].height).toBeCloseTo(0.6, 5)
})
