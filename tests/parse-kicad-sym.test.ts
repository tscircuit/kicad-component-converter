import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseKicadSymToSchematicPortInfo } from "src/parse-kicad-sym-to-schematic-port-info"

const fixturePath = join(
  import.meta.dirname,
  "fixtures",
  "simple_opamp.kicad_sym",
)

test("parseKicadSymToSchematicPortInfo: extracts port_arrangement and port_labels from a bare (symbol ...) block", () => {
  const symContent = readFileSync(fixturePath, "utf-8")
  const result = parseKicadSymToSchematicPortInfo(symContent)

  // Pins 1 and 2 have angle=0 → left side
  expect(result.port_arrangement.left_side?.pins).toEqual([1, 2])
  expect(result.port_arrangement.left_side?.direction).toBe("top-to-bottom")

  // Pin 5 has angle=180 → right side
  expect(result.port_arrangement.right_side?.pins).toEqual([5])

  // Pin 3 has angle=270 → top side
  expect(result.port_arrangement.top_side?.pins).toEqual([3])

  // Pin 4 has angle=90 → bottom side
  expect(result.port_arrangement.bottom_side?.pins).toEqual([4])

  // Labels for all named pins
  expect(result.port_labels["pin1"]).toBe("IN-")
  expect(result.port_labels["pin2"]).toBe("IN+")
  expect(result.port_labels["pin3"]).toBe("VCC")
  expect(result.port_labels["pin4"]).toBe("GND")
  expect(result.port_labels["pin5"]).toBe("OUT")
})

test("parseKicadSymToSchematicPortInfo: handles kicad_symbol_lib wrapper", () => {
  const symContent = readFileSync(fixturePath, "utf-8")
  // Wrap in a library block
  const libContent = `(kicad_symbol_lib\n  (version 20231120)\n  (generator "kicad_symbol_editor")\n  ${symContent}\n)`
  const result = parseKicadSymToSchematicPortInfo(libContent)

  expect(result.port_arrangement.left_side?.pins).toEqual([1, 2])
  expect(result.port_arrangement.right_side?.pins).toEqual([5])
  expect(result.port_labels["pin1"]).toBe("IN-")
})

test("parseKicadSymToSchematicPortInfo: returns empty info for empty input", () => {
  const result = parseKicadSymToSchematicPortInfo("(symbol \"Empty\")")
  expect(result.port_arrangement).toEqual({})
  expect(result.port_labels).toEqual({})
})
