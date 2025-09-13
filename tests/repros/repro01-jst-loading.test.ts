import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "node:fs"
import { join } from "node:path"

test("jst loading issue with pin numbers", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "../../kicad-footprints/Connector_JST.pretty/JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Log pcb_plated_holes for inspection
  const platedHoles = circuitJson.filter(
    (element: any) => element.type === "pcb_plated_hole",
  )

  expect(platedHoles).toMatchInlineSnapshot(`
    [
      {
        "hole_diameter": 0.75,
        "layers": [
          "top",
          "bottom",
        ],
        "outer_diameter": 1.2,
        "pcb_component_id": "pcb_component_0",
        "pcb_plated_hole_id": "pcb_plated_hole_0",
        "pcb_port_id": "pcb_port_0",
        "port_hints": [
          "1",
        ],
        "shape": "circle",
        "type": "pcb_plated_hole",
        "x": 0,
        "y": -0,
      },
      {
        "hole_height": 0.75,
        "hole_width": 0.75,
        "layers": [
          "top",
          "bottom",
        ],
        "outer_height": 1.75,
        "outer_width": 1.2,
        "pcb_component_id": "pcb_component_0",
        "pcb_plated_hole_id": "pcb_plated_hole_1",
        "pcb_port_id": "pcb_port_1",
        "port_hints": [
          "2",
        ],
        "shape": "pill",
        "type": "pcb_plated_hole",
        "x": 2,
        "y": -0,
      },
    ]
  `)

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
