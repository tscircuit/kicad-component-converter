import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("R_01005_0402Metric courtyard from fp_lines", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects.length).toBe(1)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  // The courtyard lines form a rect from (-0.6, -0.3) to (0.6, 0.3)
  // Width = 1.2, Height = 0.6, Center = (0, 0)
  expect(rect.width).toBeCloseTo(1.2, 5)
  expect(rect.height).toBeCloseTo(0.6, 5)
  expect(rect.center.x).toBeCloseTo(0, 5)
  expect(rect.center.y).toBeCloseTo(0, 5)
})

test("DIP-10_W10.16mm courtyard from fp_rect", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects.length).toBe(1)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  // fp_rect start=(-1.05, -1.52) end=(11.21, 11.68)
  // Width = 12.26, Height = 13.2, Center = (5.08, 5.08)
  expect(rect.width).toBeCloseTo(12.26, 5)
  expect(rect.height).toBeCloseTo(13.2, 5)
  expect(rect.center.x).toBeCloseTo(5.08, 5)
  // y is negated: -(-1.52 + 11.68)/2 = -(10.16/2) = -5.08
  expect(rect.center.y).toBeCloseTo(-5.08, 5)
})

test("courtyard fp_lines are not emitted as silkscreen", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Courtyard lines should NOT appear as silkscreen paths
  const silkscreenPaths = circuitJson.filter(
    (el: any) => el.type === "pcb_silkscreen_path",
  )
  // R_01005_0402Metric has no silkscreen lines
  expect(silkscreenPaths.length).toBe(0)
})
