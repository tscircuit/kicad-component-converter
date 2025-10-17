import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "../src"
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
  expect(courtyards[0].type).toBe("pcb_courtyard_rect")
  expect(courtyards[0].layer).toBe("top")
  expect(courtyards[0].stroke_width).toBe("0.05mm")

  // Verify the courtyard dimensions are correct
  // From the kicad_mod file, courtyard is from -6.8,-2.6 to 6.8,2.6
  // So width should be 13.6mm, height should be 5.2mm
  expect(courtyards[0].width).toBe("13.6mm")
  expect(courtyards[0].height).toBe("5.2mm")
  expect(courtyards[0].center.x).toBeCloseTo(0, 1)
  expect(courtyards[0].center.y).toBeCloseTo(0, 1)
})

test("parse courtyard from R_01005_0402Metric", async () => {
  const kicadModPath = join(
    import.meta.dirname,
    "data",
    "R_01005_0402Metric.kicad_mod",
  )
  const kicadModContent = fs.readFileSync(kicadModPath, "utf-8")

  const result = await parseKicadModToCircuitJson(kicadModContent)

  const courtyards = result.filter((e: any) => e.type === "pcb_courtyard_rect")

  // R_01005 has courtyards
  expect(courtyards.length).toBeGreaterThan(0)
  expect(courtyards[0].type).toBe("pcb_courtyard_rect")
  expect(courtyards[0].layer).toBe("top")
})
