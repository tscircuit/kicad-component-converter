import { expect, test } from "bun:test"
import { parseKicadSymToCircuitJson } from "src/parse-kicad-sym-to-circuit-json"

test("parse basic kicad_sym into schematic ports and labels", async () => {
  const fileContent = `(symbol "TestSymbol"
    (pin_names (offset 0))
    (pin_numbers hide)
    (symbol "TestSymbol_0_1"
      (pin passive line (at 0 0 0) (length 2.54)
        (name "A" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin passive line (at 10 0 180) (length 2.54)
        (name "B" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
    )
  )`

  const circuitJson = await parseKicadSymToCircuitJson(fileContent)
  const schematicComponent = circuitJson.find(
    (x: any) => x.type === "schematic_component",
  ) as any
  const schematicPorts = circuitJson.filter(
    (x: any) => x.type === "schematic_port",
  ) as any[]
  const sourcePorts = circuitJson.filter(
    (x: any) => x.type === "source_port",
  ) as any[]

  expect(schematicComponent).toBeTruthy()
  expect(schematicComponent.schPortArrangement.leftSide).toEqual(["1"])
  expect(schematicComponent.schPortArrangement.rightSide).toEqual(["2"])
  expect(schematicComponent.pinLabels["1"]).toBe("A")
  expect(schematicComponent.pinLabels["2"]).toBe("B")
  expect(schematicPorts.length).toBe(2)
  expect(sourcePorts.length).toBe(2)
})

test("parse kicad_symbol_lib wrapper and preserve non-numeric pins", async () => {
  const fileContent = `(kicad_symbol_lib
    (version 20211014)
    (generator kicad_symbol_editor)
    (symbol "WrappedSymbol"
      (symbol "WrappedSymbol_0_1"
        (pin passive line (at 0 0 90) (length 2.54)
          (name "VCC" (effects (font (size 1.27 1.27))))
          (number "A1" (effects (font (size 1.27 1.27))))
        )
        (pin passive line (at 0 10 270) (length 2.54)
          (name "GND" (effects (font (size 1.27 1.27))))
          (number "2" (effects (font (size 1.27 1.27))))
        )
      )
    )
  )`

  const circuitJson = await parseKicadSymToCircuitJson(fileContent)
  const sourceComponent = circuitJson.find(
    (x: any) => x.type === "source_component",
  ) as any
  const schematicComponent = circuitJson.find(
    (x: any) => x.type === "schematic_component",
  ) as any
  const sourcePorts = circuitJson.filter(
    (x: any) => x.type === "source_port",
  ) as any[]

  expect(sourceComponent.name).toBe("WrappedSymbol")
  expect(schematicComponent.schPortArrangement.bottomSide).toEqual(["A1"])
  expect(schematicComponent.schPortArrangement.topSide).toEqual(["2"])
  expect(schematicComponent.pinLabels["A1"]).toBe("VCC")
  expect(schematicComponent.pinLabels["2"]).toBe("GND")
  expect(sourcePorts.find((p) => p.name === "A1")?.pin_number).toBeUndefined()
  expect(sourcePorts.find((p) => p.name === "2")?.pin_number).toBe(2)
})
