import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { parseKicadModToKicadJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("courtyard rects on both front and back layers", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/courtyard-test.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  // Verify parsing picks up fp_rects
  const kicadJson = parseKicadModToKicadJson(fileContent)
  expect(kicadJson.fp_rects).toBeDefined()
  expect(kicadJson.fp_rects!.length).toBe(2)

  // Verify circuit JSON includes 2 courtyard rects
  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBe(2)

  // Front courtyard
  const frontRect = courtyardRects.find(
    (r: any) => r.layer === "top",
  ) as any
  expect(frontRect).toBeDefined()
  expect(frontRect.center.x).toBeCloseTo(0)
  expect(frontRect.center.y).toBeCloseTo(0)
  expect(frontRect.width).toBeCloseTo(4)
  expect(frontRect.height).toBeCloseTo(3)

  // Back courtyard
  const backRect = courtyardRects.find(
    (r: any) => r.layer === "bottom",
  ) as any
  expect(backRect).toBeDefined()
  expect(backRect.center.x).toBeCloseTo(0)
  expect(backRect.center.y).toBeCloseTo(0)
  expect(backRect.width).toBeCloseTo(5)
  expect(backRect.height).toBeCloseTo(4)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
