import { test, expect } from "bun:test"
import { parseKicadSymToKicadJson, convertKicadSymToSchematic } from "src"
import fs from "fs"
import { join } from "path"

const symContent = fs.readFileSync(
  join(import.meta.dirname, "fixtures/my-chip.kicad_sym"),
  "utf8",
)

test("parseKicadSymToKicadJson extracts pins with resolved sides", () => {
  const symbols = parseKicadSymToKicadJson(symContent)
  expect(symbols).toHaveLength(1)

  const symbol = symbols[0]!
  expect(symbol.name).toBe("MyChip")
  expect(symbol.pins).toHaveLength(5)

  const byNumber = Object.fromEntries(symbol.pins.map((p) => [p.number, p]))
  expect(byNumber["1"]).toMatchObject({ name: "VCC", side: "left" })
  expect(byNumber["2"]).toMatchObject({ name: "GND", side: "left" })
  expect(byNumber["3"]).toMatchObject({ name: "OUT", side: "right" })
  expect(byNumber["4"]).toMatchObject({ name: "IN", side: "right" })
  expect(byNumber["5"]).toMatchObject({ name: "EN", side: "top" })
})

test("convertKicadSymToSchematic produces pinLabels and schPortArrangement", () => {
  const [schematic] = convertKicadSymToSchematic(symContent)

  expect(schematic!.name).toBe("MyChip")

  expect(schematic!.pinLabels).toEqual({
    pin1: "VCC",
    pin2: "GND",
    pin3: "OUT",
    pin4: "IN",
    pin5: "EN",
  })

  expect(schematic!.schPortArrangement).toEqual({
    // Left pins ordered top-to-bottom: pin1 (y=2.54) above pin2 (y=-2.54)
    leftSide: { pins: [1, 2], direction: "top-to-bottom" },
    // Right pins ordered top-to-bottom: pin3 (y=2.54) above pin4 (y=-2.54)
    rightSide: { pins: [3, 4], direction: "top-to-bottom" },
    // Single top pin
    topSide: { pins: [5], direction: "left-to-right" },
  })
})
