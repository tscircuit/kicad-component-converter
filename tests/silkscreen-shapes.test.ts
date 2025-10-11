import { expect, test } from "bun:test"
import { parseKicadModToCircuitJson } from "src"

const SILKSCREEN_FIXTURE = `
(module silkscreen-shapes (layer F.Cu)
  (pad 1 smd rect (at 0 0) (size 1 1) (layers F.Cu))
  (fp_line
    (start -2 1)
    (end 2 1)
    (stroke (width 0.4) (type solid))
    (layer F.SilkS)
  )
  (fp_circle
    (center 0 -2)
    (end 1 -2)
    (stroke (width 0.2) (type solid))
    (layer F.SilkS)
  )
)
`

test("silkscreen pill and circle are parsed", async () => {
  const circuitJson = await parseKicadModToCircuitJson(SILKSCREEN_FIXTURE)
  const pill = circuitJson.find(
    (elm) => elm.type === "pcb_silkscreen_pill",
  ) as any
  expect(pill).toBeDefined()
  expect(pill.layer).toBe("top")
  expect(pill.center.x).toBeCloseTo(0)
  expect(pill.center.y).toBeCloseTo(-1)
  expect(pill.width).toBeCloseTo(4.4)
  expect(pill.height).toBeCloseTo(0.4)

  const circle = circuitJson.find(
    (elm) => elm.type === "pcb_silkscreen_circle",
  ) as any
  expect(circle).toBeDefined()
  expect(circle.layer).toBe("top")
  expect(circle.center.x).toBeCloseTo(0)
  expect(circle.center.y).toBeCloseTo(2)
  expect(circle.radius).toBeCloseTo(1)
})
