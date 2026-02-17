import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "../src/parse-kicad-mod-to-circuit-json"
import fs from "fs"
import path from "path"

test("courtyard from fp_line segments (R_01005_0402Metric)", async () => {
  const kicadMod = fs.readFileSync(
    path.join(__dirname, "data/R_01005_0402Metric.kicad_mod"),
    "utf-8",
  )
  const circuitJson = await parseKicadModToCircuitJson(kicadMod)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  expect(courtyards.length).toBe(1)

  const courtyard = courtyards[0] as any
  expect(courtyard.layer).toBe("top")
  expect(courtyard.pcb_component_id).toBe("pcb_component_0")
  expect(typeof courtyard.center.x).toBe("number")
  expect(typeof courtyard.center.y).toBe("number")
  expect(typeof courtyard.width).toBe("number")
  expect(typeof courtyard.height).toBe("number")
  expect(courtyard.width).toBeGreaterThan(0)
  expect(courtyard.height).toBeGreaterThan(0)
})

test("courtyard from fp_rect (DIP-10)", async () => {
  const kicadMod = fs.readFileSync(
    path.join(__dirname, "data/DIP-10_W10.16mm.kicad_mod"),
    "utf-8",
  )
  const circuitJson = await parseKicadModToCircuitJson(kicadMod)

  const courtyards = circuitJson.filter(
    (el: any) => el.type === "pcb_courtyard_rect",
  )

  // DIP-10 has an fp_rect on F.CrtYd
  expect(courtyards.length).toBeGreaterThanOrEqual(1)

  const courtyard = courtyards[0] as any
  expect(courtyard.layer).toBe("top")
  expect(courtyard.pcb_component_id).toBe("pcb_component_0")
  expect(courtyard.width).toBeCloseTo(12.26, 1)
  expect(courtyard.height).toBeCloseTo(13.2, 1)
})
