import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

const isFinitePoint = (point: { x: number; y: number }) =>
  Number.isFinite(point.x) && Number.isFinite(point.y)

test("fp_poly with arc segments loads without NaNs", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "..",
    "data",
    "viaGrid-pacman-1.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath, "utf-8")

  const circuitJson = await parseKicadModToCircuitJson(fileContent)
  const copperTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace" && (element as any).layer === "top",
  )

  expect(copperTraces.length).toBeGreaterThan(0)

  for (const trace of copperTraces as any[]) {
    expect(trace.route.length).toBeGreaterThan(0)
    for (const point of trace.route) {
      expect(isFinitePoint(point)).toBe(true)
    }
  }
})
