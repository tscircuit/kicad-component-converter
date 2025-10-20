import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "../src"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import * as fs from "node:fs"
import { join } from "path"

test("parse courtyard from Crystal_SMD_HC49-US", async () => {
  const kicadModPath = join(
    import.meta.dirname,
    "data",
    "Crystal_SMD_HC49-US.kicad_mod",
  )
  const kicadModContent = fs.readFileSync(kicadModPath, "utf-8")

  const result = await parseKicadModToCircuitJson(kicadModContent)

  const courtyards = result.filter((e: any) => e.type === "pcb_courtyard_rect")

  expect(courtyards.length).toBeGreaterThan(0)

  // Verify courtyard properties
  const courtyard = courtyards[0] as any
  expect(courtyard.type).toBe("pcb_courtyard_rect")
  expect(courtyard.layer).toBe("top")
  expect(courtyard.stroke_width).toBe("0.05mm")

  // Verify the courtyard dimensions are correct
  // From the kicad_mod file, courtyard is from -6.8,-2.6 to 6.8,2.6
  // So width should be 13.6mm, height should be 5.2mm
  expect(courtyard.width).toBe("13.6mm")
  expect(courtyard.height).toBe("5.2mm")
  expect(courtyard.center.x).toBeCloseTo(0, 1)
  expect(courtyard.center.y).toBeCloseTo(0, 1)

  // Snapshot test to verify visual rendering
  const svg = convertCircuitJsonToPcbSvg(result as any, { showCourtyards: true })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

