import { test, expect } from "bun:test"
import { parseKicadSymToTscircuit } from "src"
import { readFileSync } from "fs"
import { join } from "path"

const NE555_PATH = join(import.meta.dirname, "data/NE555.kicad_sym")
const NE555_CONTENT = readFileSync(NE555_PATH, "utf8")

test("NE555: pinLabels maps all 8 pins correctly", () => {
  const { pinLabels } = parseKicadSymToTscircuit(NE555_CONTENT)

  expect(pinLabels["1"]).toBe("GND")
  expect(pinLabels["2"]).toBe("TRIG")
  expect(pinLabels["3"]).toBe("OUT")
  expect(pinLabels["4"]).toBe("RESET")
  expect(pinLabels["5"]).toBe("CV")
  expect(pinLabels["6"]).toBe("THR")
  expect(pinLabels["7"]).toBe("DIS")
  expect(pinLabels["8"]).toBe("VCC")
  expect(Object.keys(pinLabels)).toHaveLength(8)
})

test("NE555: schPortArrangement assigns pins to correct sides", () => {
  const { schPortArrangement } = parseKicadSymToTscircuit(NE555_CONTENT)

  // angle 0 → left side: pins 1 (GND), 2 (TRIG), 4 (RESET), 6 (THR)
  expect(schPortArrangement.leftSide?.pins).toEqual([1, 2, 4, 6])

  // angle 180 → right side: pins 3 (OUT), 5 (CV), 7 (DIS)
  expect(schPortArrangement.rightSide?.pins).toEqual([3, 5, 7])

  // angle 270 → top side: pin 8 (VCC)
  expect(schPortArrangement.topSide?.pins).toEqual([8])

  // no bottom side pins in NE555
  expect(schPortArrangement.bottomSide).toBeUndefined()
})

test("throws when symbolName is not found in library", () => {
  expect(() =>
    parseKicadSymToTscircuit(NE555_CONTENT, "NONEXISTENT_IC"),
  ).toThrow(/NONEXISTENT_IC/)
})

test("explicit symbolName selects the correct symbol", () => {
  const { pinLabels } = parseKicadSymToTscircuit(NE555_CONTENT, "NE555")
  expect(pinLabels["1"]).toBe("GND")
  expect(Object.keys(pinLabels)).toHaveLength(8)
})

test("inline two-pin symbol: each pin assigned to opposite sides", () => {
  const twoPin = `
(kicad_symbol_lib
  (version 20211014)
  (generator kicad_symbol_editor)
  (symbol "R"
    (in_bom yes)
    (on_board yes)
    (symbol "R_1_1"
      (pin passive line
        (at -5.08 0 0)
        (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin passive line
        (at 5.08 0 180)
        (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
    )
  )
)
`
  const { pinLabels, schPortArrangement } = parseKicadSymToTscircuit(twoPin)

  // Resistor: pin 1 on left (angle 0), pin 2 on right (angle 180)
  expect(schPortArrangement.leftSide?.pins).toEqual([1])
  expect(schPortArrangement.rightSide?.pins).toEqual([2])

  // Names are "~" (unnamed pins in KiCad)
  expect(pinLabels["1"]).toBe("~")
  expect(pinLabels["2"]).toBe("~")
})
