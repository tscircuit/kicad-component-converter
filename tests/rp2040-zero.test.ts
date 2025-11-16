import { expect, test } from "bun:test"
import fs from "node:fs"
import { join } from "node:path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { parseKicadModToCircuitJson } from "src"

const fixturePath = join(import.meta.dirname, "data/RP2040-Zero.kicad_mod")

const rp2040ZeroContent = fs.readFileSync(fixturePath, "utf-8")

test("RP2040 Zero footprint renders as expected", async () => {
  const circuitJson = await parseKicadModToCircuitJson(rp2040ZeroContent)

  const svg = convertCircuitJsonToPcbSvg(circuitJson as any)

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
