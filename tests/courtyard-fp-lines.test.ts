import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { parseKicadModToKicadJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("courtyard from fp_line rectangle in R_01005_0402Metric.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/R_01005_0402Metric.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  // Verify parsing picks up courtyard lines
  const kicadJson = parseKicadModToKicadJson(fileContent)
  const courtyardLines = kicadJson.fp_lines.filter(
    (l) => l.layer.toLowerCase() === "f.crtyd",
  )
  expect(courtyardLines.length).toBe(4)

  // Verify circuit JSON includes pcb_courtyard_rect from fp_lines
  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBe(1)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  expect(rect.pcb_component_id).toBe("pcb_component_0")
  // The 4 courtyard lines form a rectangle from (-0.6, -0.3) to (0.6, 0.3)
  expect(rect.center.x).toBeCloseTo(0)
  expect(rect.center.y).toBeCloseTo(0)
  expect(rect.width).toBeCloseTo(1.2)
  expect(rect.height).toBeCloseTo(0.6)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
