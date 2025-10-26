import test from "ava"
import { parseKicadModToKicadJson } from "src/parse-kicad-mod-to-kicad-json"
import { convertKicadJsonToTsCircuitSoup } from "src/convert-kicad-json-to-tscircuit-soup"
import { readFileSync } from "fs"
import { join } from "path"

test("repro159 fp_poly with arc", async (t) => {
  const fileContent = readFileSync(join(__dirname, "../data/repro159-fp_poly.kicad_mod"), "utf8")
  const kicadJson = parseKicadModToKicadJson(fileContent)
  const soup = await convertKicadJsonToTsCircuitSoup(kicadJson)
  t.snapshot(soup)
})