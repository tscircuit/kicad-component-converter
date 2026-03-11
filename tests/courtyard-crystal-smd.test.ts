import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("Crystal_SMD_HC49-US - F.CrtYd fp_lines form a courtyard outline", async () => {
  const fileContent = fs
    .readFileSync(
      join(import.meta.dirname, "data/Crystal_SMD_HC49-US.kicad_mod"),
    )
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_outline",
  )
  expect(courtyards.length).toBe(1)
  expect((courtyards[0] as any).layer).toBe("top")

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
