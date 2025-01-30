import { test, expect } from "bun:test"
import { parseKicadModToCircuitJson } from "src"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import fs from "fs"
import { join } from "path"

test("Crystal_SMD_HC49-US.kicad_mod", async () => {
  const fixturePath = join(
    import.meta.dirname,
    "data/Crystal_SMD_HC49-US.kicad_mod",
  )
  const fileContent = fs.readFileSync(fixturePath).toString()

  const circuitJson = await parseKicadModToCircuitJson(fileContent)

  expect(convertCircuitJsonToPcbSvg(circuitJson as any)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
