import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { parseKicadModToCircuitJson } from "src"

const fixturePath = join(
  import.meta.dirname,
  "../fixtures/ProMicro-EnforcedTop.kicad_mod",
)

const loadCircuitJson = () => {
  const fileContent = fs.readFileSync(fixturePath, "utf8")
  return parseKicadModToCircuitJson(fileContent)
}

test("ProMicro footprint preserves port hints and pin numbers", async () => {
  const circuitJson = (await loadCircuitJson()) as any[]
  const sourcePorts = circuitJson.filter((el) => el.type === "source_port")
  const platedHoles = circuitJson.filter(
    (el: any) => el.type === "pcb_plated_hole",
  )

  const sourcePort1 = sourcePorts.find((port: any) => port.name === "1")
  expect(sourcePort1?.port_hints).toEqual(["1"])
  expect(sourcePort1?.pin_number).toBe(1)

  for (const port of sourcePorts) {
    const portNumber = Number(port.name)
    if (Number.isFinite(portNumber)) {
      expect(port.pin_number).toBe(portNumber)
    }
  }

  for (const platedHole of platedHoles) {
    if (platedHole.port_hints) {
      expect(platedHole.port_hints).toEqual(
        platedHole.port_hints.map((hint: any) => `${hint}`),
      )
      const pinNumber = Number(platedHole.port_hints[0])
      if (Number.isFinite(pinNumber)) {
        expect(platedHole.pin_number).toBe(pinNumber)
      }
    }
  }
})
