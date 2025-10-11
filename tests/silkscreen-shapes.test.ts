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
  (fp_line
    (start -1 -1)
    (end 1 1)
    (stroke (width 0.3) (type solid))
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
  const pills = circuitJson.filter(
    (elm) => elm.type === "pcb_silkscreen_pill",
  ) as any[]
  expect(pills.length).toBe(2)

  const horizontal = pills.find((pill) => pill.width > pill.height)
  expect(horizontal).toBeDefined()
  expect(horizontal.layer).toBe("top")
  expect(horizontal.center.x).toBeCloseTo(0)
  expect(horizontal.center.y).toBeCloseTo(-1)
  expect(horizontal.width).toBeCloseTo(4.4)
  expect(horizontal.height).toBeCloseTo(0.4)
  expect(horizontal.rotation).toBeCloseTo(0)

  const diagonal = pills.find((pill) => pill.rotation !== 0)
  expect(diagonal).toBeDefined()
  expect(diagonal.layer).toBe("top")
  expect(diagonal.center.x).toBeCloseTo(0)
  expect(diagonal.center.y).toBeCloseTo(0)
  expect(diagonal.width).toBeCloseTo(Math.sqrt(8) + 0.3)
  expect(diagonal.height).toBeCloseTo(0.3)
  expect(diagonal.rotation).toBeCloseTo(315)

  const circle = circuitJson.find(
    (elm) => elm.type === "pcb_silkscreen_circle",
  ) as any
  expect(circle).toBeDefined()
  expect(circle.layer).toBe("top")
  expect(circle.center.x).toBeCloseTo(0)
  expect(circle.center.y).toBeCloseTo(2)
  expect(circle.radius).toBeCloseTo(1)

  const paths = circuitJson.filter(
    (elm) => elm.type === "pcb_silkscreen_path",
  )
  expect(paths.length).toBe(0)
})
