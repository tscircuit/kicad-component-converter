import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("DIP-10_W10.16mm.kicad_mod - creates pcb_courtyard_rect from fp_rect", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  expect(courtyardRects.length).toBe(1)
  expect(courtyardRects[0].layer).toBe("top")
  // fp_rect: start (-1.05, -1.52) end (11.21, 11.68)
  // center: (5.08, 5.08)
  // width: 12.26, height: 13.2
  expect(courtyardRects[0].center.x).toBeCloseTo(5.08, 5)
  expect(courtyardRects[0].center.y).toBeCloseTo(-5.08, 5)
  expect(courtyardRects[0].width).toBeCloseTo(12.26, 5)
  expect(courtyardRects[0].height).toBeCloseTo(13.2, 5)
})
