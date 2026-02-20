import { expect, test } from "bun:test"
import fs from "fs"
import { join } from "path"
import { parseKicadModToCircuitJson } from "src"

test("courtyard: fp_rect + fp_poly on F.CrtYd become pcb_courtyard_*", async () => {
  const fixturePath = join(import.meta.dirname, "data/courtyard_test.kicad_mod")
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (e: any) => e?.type === "pcb_courtyard_rect",
  )
  const courtyardPaths = circuitJson.filter(
    (e: any) => e?.type === "pcb_courtyard_path",
  )

  expect(courtyardRects.length).toBe(1)
  expect(courtyardRects[0]).toMatchObject({
    type: "pcb_courtyard_rect",
    layer: "top",
    center: { x: 0, y: 0 },
    width: 4,
    height: 2,
    stroke_width: 0.05,
  })

  expect(courtyardPaths.length).toBe(1)
  expect(courtyardPaths[0]).toMatchObject({
    type: "pcb_courtyard_path",
    layer: "top",
    stroke_width: 0.05,
  })
  expect((courtyardPaths[0] as any).route.length).toBeGreaterThanOrEqual(4)
})
