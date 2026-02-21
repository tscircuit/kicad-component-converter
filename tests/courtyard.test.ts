import { expect, test } from "bun:test"
import fs from "fs"
import { join } from "path"
import { parseKicadModToCircuitJson } from "src"

test("courtyard: fp_rect + fp_poly on F.Courtyard become pcb_courtyard_outline", async () => {
  const fixturePath = join(import.meta.dirname, "data/courtyard_test.kicad_mod")
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardOutlines = circuitJson.filter(
    (e: any) => e?.type === "pcb_courtyard_outline",
  )

  expect(courtyardOutlines.length).toBe(2)

  // rect outline
  expect(courtyardOutlines[0]).toMatchObject({
    type: "pcb_courtyard_outline",
    layer: "top",
    stroke_width: 0.05,
    is_closed: true,
  })
  expect((courtyardOutlines[0] as any).outline.length).toBe(4)

  // poly outline
  expect(courtyardOutlines[1]).toMatchObject({
    type: "pcb_courtyard_outline",
    layer: "top",
    stroke_width: 0.05,
    is_closed: true,
  })
  expect((courtyardOutlines[1] as any).outline.length).toBeGreaterThanOrEqual(4)
})
