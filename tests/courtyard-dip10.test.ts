import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("DIP-10 - F.CrtYd fp_rect produces a courtyard rect", async () => {
  const fileContent = fs
    .readFileSync(join(import.meta.dirname, "data/DIP-10_W10.16mm.kicad_mod"))
    .toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )
  expect(courtyards.length).toBe(1)
  expect((courtyards[0] as any).layer).toBe("top")
  expect(typeof (courtyards[0] as any).width).toBe("number")
  expect(typeof (courtyards[0] as any).height).toBe("number")

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any, {
    showCourtyards: true,
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
