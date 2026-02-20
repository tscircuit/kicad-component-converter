import { expect, test } from "bun:test"
import fs from "fs"
import path from "path"
import { convertKicadJsonToTsCircuitSoup } from "../src/convert-kicad-json-to-tscircuit-soup"
import { convertKicadModToKicadJson } from "../src/parse-kicad-mod-to-kicad-json"

test("fp_circle on F.SilkS becomes pcb_silkscreen_circle", async () => {
  const modPath = path.join(
    import.meta.dir,
    "data",
    "fp_circle_silks.kicad_mod",
  )
  const modText = fs.readFileSync(modPath, "utf-8")
  const kicadJson = await convertKicadModToKicadJson(modText)
  const circuitJson = await convertKicadJsonToTsCircuitSoup(kicadJson)

  const circles = circuitJson.filter(
    (e: any) => e && e.type === "pcb_silkscreen_circle",
  )
  expect(circles.length).toBe(1)
  expect(circles[0]).toMatchObject({
    type: "pcb_silkscreen_circle",
    layer: "top",
    center: { x: 1, y: -2 },
    radius: 2,
    stroke_width: 0.15,
  })
})
