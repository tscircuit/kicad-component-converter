import { test, expect } from "bun:test"
import { parseKicadSymToKicadJson } from "src/parse-kicad-sym-to-kicad-json"
import { convertKicadSymToSchematicInfo } from "src/convert-kicad-sym-to-schematic-info"
import { parseKicadFilesToCircuitJson } from "src/parse-kicad-files-to-circuit-json"
import fs from "fs"
import { join } from "path"

test("parse kicad_sym to kicad json", () => {
  const fixturePath = join(import.meta.dirname, "data/TestOpAmp.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const result = parseKicadSymToKicadJson(fileContent)

  expect(result.version).toBe("20211014")
  expect(result.generator).toBe("kicad_symbol_editor")
  expect(result.symbols).toHaveLength(1)

  const sym = result.symbols[0]
  expect(sym.name).toBe("TestOpAmp")
  expect(sym.properties).toHaveLength(2)
  expect(sym.properties[0].key).toBe("Reference")
  expect(sym.properties[0].value).toBe("U")

  // Pins are in unit sub-symbols
  const allPins = sym.units.flatMap((u) => u.pins)
  expect(allPins).toHaveLength(5)

  const pin1 = allPins.find((p) => p.number === "1")!
  expect(pin1.name).toBe("IN+")
  expect(pin1.pin_type).toBe("input")
  expect(pin1.at[2]).toBe(0)

  const pin3 = allPins.find((p) => p.number === "3")!
  expect(pin3.name).toBe("OUT")
  expect(pin3.at[2]).toBe(180)
})

test("convert kicad_sym to schematic info", () => {
  const fixturePath = join(import.meta.dirname, "data/TestOpAmp.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const symJson = parseKicadSymToKicadJson(fileContent)
  const info = convertKicadSymToSchematicInfo(symJson)

  expect(info.symbolName).toBe("U")
  expect(info.symbolDisplayValue).toBe("TestOpAmp")

  // Pins with rotation 0 point right -> left_side
  expect(info.schPortArrangement.left_side).toContain("1")
  expect(info.schPortArrangement.left_side).toContain("2")
  // Pin with rotation 180 points left -> right_side
  expect(info.schPortArrangement.right_side).toContain("3")
  // Pin with rotation 270 points down -> top_side
  expect(info.schPortArrangement.top_side).toContain("4")
  // Pin with rotation 90 points up -> bottom_side
  expect(info.schPortArrangement.bottom_side).toContain("5")

  expect(info.pinLabels["1"]).toBe("IN+")
  expect(info.pinLabels["3"]).toBe("OUT")
  expect(info.pinLabels["4"]).toBe("VCC")
  expect(info.pinLabels["5"]).toBe("GND")
})

test("parseKicadFilesToCircuitJson with kicad_sym only", async () => {
  const fixturePath = join(import.meta.dirname, "data/TestOpAmp.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadFilesToCircuitJson({
    kicad_sym: fileContent,
  })

  const schComponent = circuitJson.find(
    (e: any) => e.type === "schematic_component",
  ) as any
  expect(schComponent).toBeTruthy()
  expect(schComponent.port_arrangement).toBeTruthy()
  expect(schComponent.port_labels).toBeTruthy()
  expect(schComponent.symbol_name).toBe("U")
  expect(schComponent.symbol_display_value).toBe("TestOpAmp")
})
