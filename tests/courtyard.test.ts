import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("courtyard from fp_line (R_01005_0402Metric)", async () => {
  const fileContent = readFileSync(
    join(import.meta.dirname, "data", "R_01005_0402Metric.kicad_mod"),
    "utf-8",
  )
  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (e: any) => e.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBe(1)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  expect(rect.width).toBeCloseTo(1.2, 1)
  expect(rect.height).toBeCloseTo(0.6, 1)
  expect(rect.center.x).toBeCloseTo(0, 1)
  expect(rect.center.y).toBeCloseTo(0, 1)

  expect(convertCircuitJsonToPcbSvg(circuitJson as any, { showCourtyards: true })).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("courtyard from fp_rect (DIP-10_W10.16mm)", async () => {
  const fileContent = readFileSync(
    join(import.meta.dirname, "data", "DIP-10_W10.16mm.kicad_mod"),
    "utf-8",
  )
  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (e: any) => e.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBe(1)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  // DIP-10 fp_rect: start (-1.05, -1.52) end (11.21, 11.68)
  expect(rect.width).toBeCloseTo(12.26, 1)
  expect(rect.height).toBeCloseTo(13.2, 1)

  expect(convertCircuitJsonToPcbSvg(circuitJson as any, { showCourtyards: true })).toMatchSvgSnapshot(
    `${import.meta.path}.dip`,
  )
})
