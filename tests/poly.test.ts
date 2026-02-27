import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { parseKicadModToCircuitJson } from "src"

test("poly.kicad_mod", async () => {
  const fixturePath = join(import.meta.dirname, "data/poly.kicad_mod")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const silkscreenPaths = circuitJson.filter(
    (elm) => elm.type === "pcb_silkscreen_path",
  )
  expect(silkscreenPaths.length).toBe(1)
  expect((silkscreenPaths[0] as any).route.length).toBe(5)
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
