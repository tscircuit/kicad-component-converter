import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { parseKicadModToCircuitJson } from "src"

test("converts fp_rect courtyard to pcb_courtyard_rect", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const courtyardRects = circuitJson.filter(
    (element) => element.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects).toHaveLength(1)
  const rect = courtyardRects[0] as any
  expect(rect.type).toBe("pcb_courtyard_rect")
  expect(rect.pcb_component_id).toBe("pcb_component_0")
  expect(rect.layer).toBe("top")
  expect(rect.center.x).toBeCloseTo(5.08, 6)
  expect(rect.center.y).toBeCloseTo(-5.08, 6)
  expect(rect.width).toBeCloseTo(12.26, 6)
  expect(rect.height).toBeCloseTo(13.2, 6)
})

test("converts courtyard fp_line rectangle to pcb_courtyard_rect", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const courtyardRects = circuitJson.filter(
    (element) => element.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects).toHaveLength(1)
  const rect = courtyardRects[0] as any
  expect(rect.type).toBe("pcb_courtyard_rect")
  expect(rect.pcb_component_id).toBe("pcb_component_0")
  expect(rect.layer).toBe("top")
  expect(rect.center.x).toBeCloseTo(0, 6)
  expect(rect.center.y).toBeCloseTo(0, 6)
  expect(rect.width).toBeCloseTo(1.2, 6)
  expect(rect.height).toBeCloseTo(0.6, 6)
})
