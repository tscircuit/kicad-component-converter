import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { parseKicadModToCircuitJson } from "src"

const fixturePath = join(import.meta.dirname, "../fixtures/SimpleSmd.kicad_mod")

const loadCircuitJson = () => {
  const fileContent = fs.readFileSync(fixturePath, "utf8")
  return parseKicadModToCircuitJson(fileContent)
}

test("SMD pad carries pin_number on pcb_smtpad", async () => {
  const circuitJson = (await loadCircuitJson()) as any[]
  const smtPads = circuitJson.filter((el) => el.type === "pcb_smtpad")

  expect(smtPads).toHaveLength(1)
  const pad = smtPads[0]

  expect(pad.port_hints).toEqual(["pin1"])
  expect(pad.pin_number).toBe(1)
})
