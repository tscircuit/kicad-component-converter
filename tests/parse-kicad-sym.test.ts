import { expect, it, describe } from "bun:test"
import { parseKicadSymToTscircuit } from "src/parse-kicad-sym-to-tscircuit"

// Minimal NE555 .kicad_sym snippet for testing
const NE555_SYM = `(kicad_symbol_lib
  (version 20220914)
  (generator kicad_symbol_editor)
  (symbol "NE555"
    (symbol "NE555_0_1"
      (pin input line (at -12.7 5.08 0) (length 2.54)
        (name "TR" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
      (pin output line (at 12.7 -2.54 180) (length 2.54)
        (name "OUT" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27))))
      )
      (pin input line (at -12.7 -5.08 0) (length 2.54)
        (name "RST" (effects (font (size 1.27 1.27))))
        (number "4" (effects (font (size 1.27 1.27))))
      )
      (pin passive line (at 12.7 5.08 180) (length 2.54)
        (name "CV" (effects (font (size 1.27 1.27))))
        (number "5" (effects (font (size 1.27 1.27))))
      )
      (pin input line (at -12.7 2.54 0) (length 2.54)
        (name "THR" (effects (font (size 1.27 1.27))))
        (number "6" (effects (font (size 1.27 1.27))))
      )
      (pin open_collector line (at 12.7 2.54 180) (length 2.54)
        (name "DIS" (effects (font (size 1.27 1.27))))
        (number "7" (effects (font (size 1.27 1.27))))
      )
      (pin power_in line (at 0 12.7 270) (length 2.54)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "8" (effects (font (size 1.27 1.27))))
      )
      (pin power_in line (at 0 -12.7 90) (length 2.54)
        (name "GND" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
    )
  )
)`

describe("parseKicadSymToTscircuit", () => {
  it("parses pin labels from a NE555 symbol", () => {
    const result = parseKicadSymToTscircuit(NE555_SYM)
    expect(result.pinLabels).toMatchObject({
      "1": "GND",
      "2": "TR",
      "3": "OUT",
      "4": "RST",
      "5": "CV",
      "6": "THR",
      "7": "DIS",
      "8": "VCC",
    })
  })

  it("maps pin angles to the correct schematic sides", () => {
    const result = parseKicadSymToTscircuit(NE555_SYM)
    const { schPortArrangement } = result

    // Pins with angle=0 (stub points right) → leftSide
    // Pins 2, 4, 6 have angle=0
    expect(schPortArrangement.leftSide?.pins).toContain(2)
    expect(schPortArrangement.leftSide?.pins).toContain(4)
    expect(schPortArrangement.leftSide?.pins).toContain(6)

    // Pins with angle=180 (stub points left) → rightSide
    // Pins 3, 5, 7 have angle=180
    expect(schPortArrangement.rightSide?.pins).toContain(3)
    expect(schPortArrangement.rightSide?.pins).toContain(5)
    expect(schPortArrangement.rightSide?.pins).toContain(7)

    // Pin 8 has angle=270 (stub points down) → topSide
    expect(schPortArrangement.topSide?.pins).toContain(8)

    // Pin 1 has angle=90 (stub points up) → bottomSide
    expect(schPortArrangement.bottomSide?.pins).toContain(1)
  })

  it("extracts the component name", () => {
    const result = parseKicadSymToTscircuit(NE555_SYM)
    expect(result.componentName).toBe("NE555")
  })

  it("throws for invalid content", () => {
    expect(() => parseKicadSymToTscircuit("(not_a_kicad_sym_lib)")).toThrow()
  })
})
