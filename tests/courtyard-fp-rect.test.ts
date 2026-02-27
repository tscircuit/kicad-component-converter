import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { parseKicadModToKicadJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("courtyard from fp_rect in DIP-10_W10.16mm.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/DIP-10_W10.16mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  // Verify parsing picks up fp_rects
  const kicadJson = parseKicadModToKicadJson(fileContent)
  expect(kicadJson.fp_rects).toBeDefined()
  expect(kicadJson.fp_rects!.length).toBeGreaterThan(0)

  // Find the courtyard fp_rect
  const courtyardRect = kicadJson.fp_rects!.find(
    (r) => r.layer.toLowerCase() === "f.crtyd",
  )
  expect(courtyardRect).toBeDefined()
  expect(courtyardRect!.start).toEqual([-1.05, -1.52])
  expect(courtyardRect!.end).toEqual([11.21, 11.68])

  // Verify circuit JSON includes pcb_courtyard_rect
  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  expect(courtyardRects.length).toBeGreaterThan(0)

  const rect = courtyardRects[0] as any
  expect(rect.layer).toBe("top")
  expect(rect.pcb_component_id).toBe("pcb_component_0")
  // Center should be midpoint of start and end
  expect(rect.center.x).toBeCloseTo((-1.05 + 11.21) / 2)
  expect(rect.center.y).toBeCloseTo(-((-1.52 + 11.68) / 2))
  expect(rect.width).toBeCloseTo(11.21 - -1.05)
  expect(rect.height).toBeCloseTo(11.68 - -1.52)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
