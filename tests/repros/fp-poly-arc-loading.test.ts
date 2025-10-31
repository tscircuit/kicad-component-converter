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
  const copperPolygons = circuitJson.filter((element) => {
    if (element.type !== "pcb_smtpad") return false
    const pad = element as any
    return pad.layer === "top" && Array.isArray(pad.points)
  })

  expect(copperPolygons.length).toBeGreaterThan(0)

  for (const pad of copperPolygons as any[]) {
    expect(pad.points.length).toBeGreaterThan(3)
    for (const point of pad.points) {
      expect(isFinitePoint(point)).toBe(true)
    }

    const minX = Math.min(...pad.points.map((point: any) => point.x))
    const maxX = Math.max(...pad.points.map((point: any) => point.x))

    expect(minX).toBeLessThan(-1)
    expect(maxX).toBeGreaterThan(2)
  }
})
