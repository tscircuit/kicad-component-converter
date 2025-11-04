import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("fp_poly with arc segments loads without NaNs", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "..",
    "data",
    "viaGrid-pacman-1mm.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf-8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const result = convertCircuitJsonToPcbSvg(circuitJson as any)
  // validate the segment length should be around 0.1mm
  const arcSegments = result.match(/<path d="([^"]+)"/g) || []
  for (const pathTag of arcSegments) {
    const dAttrMatch = pathTag.match(/<path d="([^"]+)"/)
    if (!dAttrMatch) continue
    const dAttr = dAttrMatch[1]
    const commands = dAttr.match(/[ML][^ML]+/g) || []
    for (let i = 1; i < commands.length; i++) {
      const [x1, y1] = commands[i - 1].slice(1).trim().split(" ").map(Number)
      const [x2, y2] = commands[i].slice(1).trim().split(" ").map(Number)
      const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      expect(segmentLength).toBeLessThanOrEqual(0.1) // allow small tolerance
    }
  }
  expect(result).toMatchSvgSnapshot(import.meta.path)
})
