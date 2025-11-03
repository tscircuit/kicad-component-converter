import { test } from "bun:test"
import { expect } from "bun:test"
import { convertKicadJsonToTsCircuitSoup } from "../src/convert-kicad-json-to-tscircuit-soup"
import { parseKicadModToKicadJson } from "../src/parse-kicad-mod-to-kicad-json"

test("resolvedPcbStyle.silkscreenFontSize overrides kicad silkscreen font size", async () => {
  const kicadModContent = `(footprint "TEST_FOOTPRINT" (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 -1.17) (layer "F.SilkS")
    (effects (font (size 1 1) (thickness 0.15)))
  )
  (fp_text value "TEST_VALUE" (at 0 1.17) (layer "F.SilkS")
    (effects (font (size 0.8 0.8) (thickness 0.12)))
  )
  (pad "1" smd rect (at -0.5 0) (size 0.5 0.6) (layers "F.Cu" "F.Paste" "F.Mask"))
)`

  const kicadJson = parseKicadModToKicadJson(kicadModContent)

  // Convert without resolvedPcbStyle
  const circuitJsonDefault = await convertKicadJsonToTsCircuitSoup(kicadJson)
  const silkscreenTextsDefault = circuitJsonDefault.filter(
    (el: any) => el.type === "pcb_silkscreen_text",
  ) as any[]

  // Verify default font sizes from kicad
  expect(silkscreenTextsDefault[0].font_size).toBe(1)
  expect(silkscreenTextsDefault[1].font_size).toBe(0.8)

  // Convert with resolvedPcbStyle
  const circuitJsonWithStyle = await convertKicadJsonToTsCircuitSoup(
    kicadJson,
    {
      resolvedPcbStyle: {
        silkscreenFontSize: 2.5,
      },
    },
  )
  const silkscreenTextsWithStyle = circuitJsonWithStyle.filter(
    (el: any) => el.type === "pcb_silkscreen_text",
  ) as any[]

  // Verify all silkscreen texts use the overridden font size
  expect(silkscreenTextsWithStyle[0].font_size).toBe(2.5)
  expect(silkscreenTextsWithStyle[1].font_size).toBe(2.5)
})

test("resolvedPcbStyle.silkscreenFontSize does not affect fabrication text", async () => {
  const kicadModContent = `(footprint "TEST_FOOTPRINT" (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 -1.17) (layer "F.SilkS")
    (effects (font (size 1 1) (thickness 0.15)))
  )
  (fp_text value "TEST_VALUE" (at 0 1.17) (layer "F.Fab")
    (effects (font (size 0.8 0.8) (thickness 0.12)))
  )
)`

  const kicadJson = parseKicadModToKicadJson(kicadModContent)

  // Convert with resolvedPcbStyle
  const circuitJson = await convertKicadJsonToTsCircuitSoup(kicadJson, {
    resolvedPcbStyle: {
      silkscreenFontSize: 2.5,
    },
  })

  const silkscreenTexts = circuitJson.filter(
    (el: any) => el.type === "pcb_silkscreen_text",
  ) as any[]
  const fabTexts = circuitJson.filter(
    (el: any) => el.type === "pcb_fabrication_note_text",
  ) as any[]

  // Silkscreen should use overridden size
  expect(silkscreenTexts[0].font_size).toBe(2.5)

  // Fabrication text should keep original size
  expect(fabTexts[0].font_size).toBe(0.8)
})

test("resolvedPcbStyle with undefined silkscreenFontSize uses kicad defaults", async () => {
  const kicadModContent = `(footprint "TEST_FOOTPRINT" (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 -1.17) (layer "F.SilkS")
    (effects (font (size 1.5 1.5) (thickness 0.15)))
  )
)`

  const kicadJson = parseKicadModToKicadJson(kicadModContent)

  // Convert with empty resolvedPcbStyle
  const circuitJson = await convertKicadJsonToTsCircuitSoup(kicadJson, {
    resolvedPcbStyle: {},
  })

  const silkscreenTexts = circuitJson.filter(
    (el: any) => el.type === "pcb_silkscreen_text",
  ) as any[]

  // Should use kicad default
  expect(silkscreenTexts[0].font_size).toBe(1.5)
})
