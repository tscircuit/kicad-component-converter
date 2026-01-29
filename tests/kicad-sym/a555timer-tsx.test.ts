import { test, expect } from "bun:test"
import { parseKicadSymToCircuitJson } from "src"
import { convertKicadSymToTscircuitTsx } from "src/convert-kicad-sym-to-tscircuit-tsx"
import fs from "fs"
import { join } from "path"

test("a555timer.kicad_sym tsx generation", async () => {
  const fixturePath = join(import.meta.dirname, "../data/a555timer.kicad_sym")
  const fileContent = fs.readFileSync(fixturePath).toString()

  const parsedSymbols = await parseKicadSymToCircuitJson(fileContent)
  const tsx = convertKicadSymToTscircuitTsx(parsedSymbols[0])

  // Verify structure
  expect(tsx).toMatchInlineSnapshot(`
    "import type { ChipProps } from "tscircuit"

    export const A555Timer = (props: ChipProps) => (
      <chip
        {...props}
        symbol={
          <symbol>
            <schematicpath points={[{ x: -9, y: -19.875 }, { x: 9, y: -19.875 }, { x: 9, y: 19.875 }, { x: -9, y: 19.875 }, { x: -9, y: -19.875 }]} strokeWidth={0.254} />
            <schematicline x1={-15} y1={16.875} x2={-9} y2={16.875} strokeWidth={0.254} />
            <port name="1" schX={-15} schY={16.875} direction="right" pinNumber={1} />
            <schematictext schX={-12} schY={17.675} text="1" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={-8.5} schY={16.875} text="GND" anchor="left" fontSize={1.27} color="brown" />
            <schematicline x1={-15} y1={5.625} x2={-9} y2={5.625} strokeWidth={0.254} />
            <port name="2" schX={-15} schY={5.625} direction="right" pinNumber={2} />
            <schematictext schX={-12} schY={6.425} text="2" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={-8.5} schY={5.625} text="TRIG" anchor="left" fontSize={1.27} color="brown" />
            <schematicline x1={-15} y1={-5.625} x2={-9} y2={-5.625} strokeWidth={0.254} />
            <port name="3" schX={-15} schY={-5.625} direction="right" pinNumber={3} />
            <schematictext schX={-12} schY={-4.825} text="3" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={-8.5} schY={-5.625} text="OUT" anchor="left" fontSize={1.27} color="brown" />
            <schematicline x1={-15} y1={-16.875} x2={-9} y2={-16.875} strokeWidth={0.254} />
            <port name="4" schX={-15} schY={-16.875} direction="right" pinNumber={4} />
            <schematictext schX={-12} schY={-16.075} text="4" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={-8.5} schY={-16.875} text="RESET" anchor="left" fontSize={1.27} color="brown" />
            <schematicline x1={15} y1={-16.875} x2={9} y2={-16.875} strokeWidth={0.254} />
            <port name="5" schX={15} schY={-16.875} direction="left" pinNumber={5} />
            <schematictext schX={12} schY={-16.075} text="5" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={8.5} schY={-16.875} text="CONT" anchor="right" fontSize={1.27} color="brown" />
            <schematicline x1={15} y1={-5.625} x2={9} y2={-5.625} strokeWidth={0.254} />
            <port name="6" schX={15} schY={-5.625} direction="left" pinNumber={6} />
            <schematictext schX={12} schY={-4.825} text="6" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={8.5} schY={-5.625} text="THRES" anchor="right" fontSize={1.27} color="brown" />
            <schematicline x1={15} y1={5.625} x2={9} y2={5.625} strokeWidth={0.254} />
            <port name="7" schX={15} schY={5.625} direction="left" pinNumber={7} />
            <schematictext schX={12} schY={6.425} text="7" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={8.5} schY={5.625} text="DISCH" anchor="right" fontSize={1.27} color="brown" />
            <schematicline x1={15} y1={16.875} x2={9} y2={16.875} strokeWidth={0.254} />
            <port name="8" schX={15} schY={16.875} direction="left" pinNumber={8} />
            <schematictext schX={12} schY={17.675} text="8" anchor="center" fontSize={1.27} color="brown" />
            <schematictext schX={8.5} schY={16.875} text="VCC" anchor="right" fontSize={1.27} color="brown" />
          </symbol>
        }
      />
    )
    "
  `)
})
