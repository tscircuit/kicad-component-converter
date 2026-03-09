import test from "ava"
import { parseKicadSymToCircuitJson } from "src/parse-kicad-sym-to-circuit-json"

test("parse basic kicad_sym into schematic ports and labels", async (t) => {
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
  const schematicComponent = circuitJson.find((x: any) => x.type === "schematic_component") as any
  const schematicPorts = circuitJson.filter((x: any) => x.type === "schematic_port") as any[]
  const sourcePorts = circuitJson.filter((x: any) => x.type === "source_port") as any[]

  t.truthy(schematicComponent)
  t.deepEqual(schematicComponent.schPortArrangement.leftSide, ["1"])
  t.deepEqual(schematicComponent.schPortArrangement.rightSide, ["2"])
  t.is(schematicComponent.pinLabels["1"], "A")
  t.is(schematicComponent.pinLabels["2"], "B")
  t.is(schematicPorts.length, 2)
  t.is(sourcePorts.length, 2)
})
