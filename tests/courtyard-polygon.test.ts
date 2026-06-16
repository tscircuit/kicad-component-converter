import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("Courtyard polygon - F.CrtYd fp_poly produces pcb_courtyard_polygon", async () => {
  const fileContent = fs
    .readFileSync(
      join(import.meta.dirname, "data/courtyard-polygon-test.kicad_mod"),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Check that pcb_courtyard_polygon is generated from fp_poly on F.CrtYd
  const courtyardPolygons = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_polygon",
  )
  expect(courtyardPolygons.length).toBe(1)
  expect((courtyardPolygons[0] as any).layer).toBe("top")
  expect((courtyardPolygons[0] as any).points.length).toBeGreaterThanOrEqual(4)

  // Also verify courtyard_outline is NOT generated from fp_poly
  // (fp_poly should produce polygon, not outline)
  const courtyardOutlines = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_outline",
  )
  expect(courtyardOutlines.length).toBe(0)

  // Verify SVG output includes courtyard geometry
  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
