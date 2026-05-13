import { test, expect } from "bun:test"
import {
  parseKicadSymPins,
  parseKicadSymToSchematicMetadata,
} from "../src/parse-kicad-sym-to-schematic-metadata"

const SIMPLE_SYM = `
(kicad_symbol_lib
  (symbol "Resistor"
    (pin passive line (at -3.81 0 0) (length 2.54)
      (name "1" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 3.81 0 180) (length 2.54)
      (name "2" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
  )
)
`

const USB_C_SYM = `
(kicad_symbol_lib
  (symbol "USB_C_Receptacle"
    (pin power_in line (at -10.16 7.62 0) (length 2.54)
      (name "VBUS" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at -10.16 2.54 0) (length 2.54)
      (name "D+" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at 10.16 2.54 180) (length 2.54)
      (name "D-" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
    (pin power_in line (at 0 -7.62 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 0 7.62 270) (length 2.54)
      (name "SHIELD" (effects (font (size 1.27 1.27))))
      (number "5" (effects (font (size 1.27 1.27))))
    )
  )
)
`

const IC_SYM = `
(kicad_symbol_lib
  (symbol "ATmega328P"
    (pin power_in line (at -12.7 10.16 0) (length 2.54)
      (name "VCC" (effects (font (size 1.27 1.27))))
      (number "7" (effects (font (size 1.27 1.27))))
    )
    (pin power_in line (at -12.7 -10.16 0) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "8" (effects (font (size 1.27 1.27))))
    )
    (pin input line (at -12.7 5.08 0) (length 2.54)
      (name "RESET" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at 12.7 10.16 180) (length 2.54)
      (name "PB0" (effects (font (size 1.27 1.27))))
      (number "14" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at 12.7 5.08 180) (length 2.54)
      (name "PB1" (effects (font (size 1.27 1.27))))
      (number "15" (effects (font (size 1.27 1.27))))
    )
    (pin bidirectional line (at 12.7 0 180) (length 2.54)
      (name "PB2" (effects (font (size 1.27 1.27))))
      (number "16" (effects (font (size 1.27 1.27))))
    )
  )
)
`

test("parseKicadSymPins extracts pins from simple resistor", () => {
  const pins = parseKicadSymPins(SIMPLE_SYM)
  expect(pins).toHaveLength(2)
  expect(pins[0]).toEqual({
    type: "passive",
    x: -3.81,
    y: 0,
    rotation: 0,
    name: "1",
    number: "1",
  })
  expect(pins[1]).toEqual({
    type: "passive",
    x: 3.81,
    y: 0,
    rotation: 180,
    name: "2",
    number: "2",
  })
})

test("parseKicadSymToSchematicMetadata generates correct pin labels", () => {
  const metadata = parseKicadSymToSchematicMetadata(USB_C_SYM)
  expect(metadata.pinLabels).toEqual({
    pin1: "VBUS",
    pin2: "D+",
    pin3: "D-",
    pin4: "GND",
    pin5: "SHIELD",
  })
})

test("parseKicadSymToSchematicMetadata assigns pins to correct sides", () => {
  const metadata = parseKicadSymToSchematicMetadata(USB_C_SYM)
  // 0° rotation → left side
  expect(metadata.schPortArrangement.leftSide.pins).toContain(1)
  expect(metadata.schPortArrangement.leftSide.pins).toContain(2)
  // 180° rotation → right side
  expect(metadata.schPortArrangement.rightSide.pins).toContain(3)
  // 90° rotation → bottom side
  expect(metadata.schPortArrangement.bottomSide.pins).toContain(4)
  // 270° rotation → top side
  expect(metadata.schPortArrangement.topSide.pins).toContain(5)
})

test("parseKicadSymToSchematicMetadata sorts pins by position", () => {
  const metadata = parseKicadSymToSchematicMetadata(IC_SYM)
  // Left side pins sorted by Y descending (higher Y first): VCC(10.16), RESET(5.08), GND(-10.16)
  expect(metadata.schPortArrangement.leftSide.pins).toEqual([7, 1, 8])
  // Right side pins sorted by Y descending: PB0(10.16), PB1(5.08), PB2(0)
  expect(metadata.schPortArrangement.rightSide.pins).toEqual([14, 15, 16])
})

test("parseKicadSymToSchematicMetadata handles tilde pin names", () => {
  const symWithTilde = `
(kicad_symbol_lib
  (symbol "Test"
    (pin passive line (at 0 0 0) (length 2.54)
      (name "~" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
  )
)
`
  const metadata = parseKicadSymToSchematicMetadata(symWithTilde)
  // Tilde means unnamed pin, should use pin number as label
  expect(metadata.pinLabels.pin1).toBe("pin1")
})
