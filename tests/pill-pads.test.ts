import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("pill pads with user layer - should render pills and omit user layers", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/pill_pads_with_user_layer.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  // Check that we have pill-shaped plated holes
  const platedHoles = circuitJson.filter(
    (elm: any) => elm.type === "pcb_plated_hole",
  )
  const pillShapes = platedHoles.filter((elm: any) => elm.shape === "pill")
  expect(pillShapes.length).toBe(4)

  // Check that we have a circular plated hole in the center
  const circularHoles = platedHoles.filter((elm: any) => elm.shape === "circle")
  expect(circularHoles.length).toBe(1)

  // Verify no silkscreen paths from User layers (arcs and lines on User layers should be omitted)
  const silkscreenPaths = circuitJson.filter(
    (elm: any) => elm.type === "pcb_silkscreen_path",
  )
  // Should have 0 silkscreen paths since there are no F.SilkS layers, only User.2 (which are omitted)
  expect(silkscreenPaths.length).toBe(0)

  // Verify pill shapes have correct properties
  const pillPad = pillShapes[0] as any
  expect(pillPad).toBeDefined()
  expect(pillPad.outer_width).toBeDefined()
  expect(pillPad.outer_height).toBeDefined()
  expect(pillPad.hole_width).toBeDefined()
  expect(pillPad.hole_height).toBeDefined()

  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
