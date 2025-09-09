import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("ADOM_MEDIUM_PIN_SHORTER_v1 has a plated hole", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/ADOM_MEDIUM_PIN_SHORTER_v1.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const platedHoles = circuitJson.filter(
    (el: any) => el.type === "pcb_plated_hole",
  )

  expect(platedHoles.length).toBe(1)
  expect(platedHoles[0].port_hints).toEqual(["1"])
})

test("unlabeled pin does not produce port hints", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/ADOM_MEDIUM_PIN_SHORTER_no_label.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const platedHole = circuitJson.find(
    (el: any) => el.type === "pcb_plated_hole",
  ) as any

  expect(platedHole.port_hints).toEqual([])
})
