import { test, expect } from "bun:test"
import { parseKicadSymToCircuitJson } from "src"
import fs from "fs"
import { join } from "path"

test("a555timer.kicad_sym symbol data extraction", async () => {
  const fixturePath = join(import.meta.dirname, "../data/a555timer.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const parsedSymbols = await parseKicadSymToCircuitJson(fileContent)
  const { symbolData } = parsedSymbols[0]

  expect(symbolData.name).toBe("A555Timer")
  expect(symbolData.pins).toHaveLength(8)
  expect(symbolData.polylines).toHaveLength(1)
  expect(symbolData.rectangles).toHaveLength(0)
  expect(symbolData.circles).toHaveLength(0)
  expect(symbolData.arcs).toHaveLength(0)

  // Verify pin extraction
  expect(symbolData.pins.map((p) => p.number)).toMatchInlineSnapshot(`
    [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]
  `)

  expect(symbolData.pins.map((p) => p.name)).toMatchInlineSnapshot(`
    [
      "GND",
      "TRIG",
      "OUT",
      "RESET",
      "CONT",
      "THRES",
      "DISCH",
      "VCC",
    ]
  `)

  // Verify polyline stroke extracted
  expect(symbolData.polylines[0].stroke?.width).toBe(0.254)
  expect(symbolData.polylines[0].stroke?.type).toBe("default")
  expect(symbolData.polylines[0].points).toHaveLength(5)
})
