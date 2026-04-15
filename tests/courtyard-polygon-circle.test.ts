import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("courtyard-polygon-circle - fp_poly and fp_circle on F.CrtYd produce courtyard elements", async () => {
  const fileContent = fs
    .readFileSync(
      join(import.meta.dirname, "data/courtyard-polygon-circle.kicad_mod"),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyardRects = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  const courtyardPolygons = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_polygon",
  )
  const courtyardCircles = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_circle",
  )

  // fp_rect on F.CrtYd → pcb_courtyard_rect
  expect(courtyardRects.length).toBe(1)
  expect((courtyardRects[0] as any).layer).toBe("top")

  // fp_poly on F.CrtYd → pcb_courtyard_polygon
  expect(courtyardPolygons.length).toBe(1)
  expect((courtyardPolygons[0] as any).layer).toBe("top")
  expect(Array.isArray((courtyardPolygons[0] as any).points)).toBe(true)
  expect((courtyardPolygons[0] as any).points.length).toBe(3)

  // fp_circle on F.CrtYd → pcb_courtyard_circle
  expect(courtyardCircles.length).toBe(1)
  expect((courtyardCircles[0] as any).layer).toBe("top")
  expect(typeof (courtyardCircles[0] as any).radius).toBe("number")
  expect((courtyardCircles[0] as any).radius).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
