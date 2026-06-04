import { test, expect } from "bun:test"
import fs from "fs"
import { join } from "path"
import { parseKicadSymToTscircuit } from "src"

test("NE555 .kicad_sym — pinLabels and schPortArrangement", () => {
  const fixturePath = join(import.meta.dirname, "data/NE555.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const result = parseKicadSymToTscircuit(fileContent)

  // All 8 pins should appear in pinLabels
  expect(Object.keys(result.pinLabels)).toHaveLength(8)
  expect(result.pinLabels["1"]).toBe("GND")
  expect(result.pinLabels["2"]).toBe("TRIG")
  expect(result.pinLabels["3"]).toBe("OUT")
  expect(result.pinLabels["4"]).toBe("RESET")
  expect(result.pinLabels["5"]).toBe("CONT")
  expect(result.pinLabels["6"]).toBe("THR")
  expect(result.pinLabels["7"]).toBe("DIS")
  expect(result.pinLabels["8"]).toBe("VCC")

  // Left side: pins with rotation 0 → TRIG(2), RESET(4), CONT(5), THR(6), DIS(7)
  const left = result.schPortArrangement.leftSide
  expect(left).toBeDefined()
  expect(left!.pins.sort()).toEqual(["2", "4", "5", "6", "7"].sort())

  // Right side: pins with rotation 180 → OUT(3)
  const right = result.schPortArrangement.rightSide
  expect(right).toBeDefined()
  expect(right!.pins).toEqual(["3"])

  // Bottom side: rotation 90 → GND(1)
  const bottom = result.schPortArrangement.bottomSide
  expect(bottom).toBeDefined()
  expect(bottom!.pins).toEqual(["1"])

  // Top side: rotation 270 → VCC(8)
  const top = result.schPortArrangement.topSide
  expect(top).toBeDefined()
  expect(top!.pins).toEqual(["8"])
})

test("NE555 — select specific symbol by name", () => {
  const fixturePath = join(import.meta.dirname, "data/NE555.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const result = parseKicadSymToTscircuit(fileContent, "NE555")
  expect(Object.keys(result.pinLabels).length).toBeGreaterThan(0)
})

test("NE555 — throws on unknown symbol name", () => {
  const fixturePath = join(import.meta.dirname, "data/NE555.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  expect(() => parseKicadSymToTscircuit(fileContent, "DOESNOTEXIST")).toThrow(
    "DOESNOTEXIST",
  )
})

test("inline kicad_sym — simple two-sided IC", () => {
  const content = `
(kicad_symbol_lib (version 20231120) (generator kicad_symbol_editor)
  (symbol "MyChip" (in_bom yes) (on_board yes)
    (symbol "MyChip_0_0"
      (pin input line (at -10.16 2.54 0) (length 2.54)
        (name "IN1" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin input line (at -10.16 0 0) (length 2.54)
        (name "IN2" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
      (pin output line (at 10.16 2.54 180) (length 2.54)
        (name "OUT1" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27))))
      )
      (pin output line (at 10.16 0 180) (length 2.54)
        (name "OUT2" (effects (font (size 1.27 1.27))))
        (number "4" (effects (font (size 1.27 1.27))))
      )
    )
  )
)`

  const result = parseKicadSymToTscircuit(content)

  expect(result.pinLabels).toEqual({
    "1": "IN1",
    "2": "IN2",
    "3": "OUT1",
    "4": "OUT2",
  })

  expect(result.schPortArrangement.leftSide?.pins.sort()).toEqual(["1", "2"])
  expect(result.schPortArrangement.rightSide?.pins.sort()).toEqual(["3", "4"])
  expect(result.schPortArrangement.topSide).toBeUndefined()
  expect(result.schPortArrangement.bottomSide).toBeUndefined()
})
