import { expect, test } from "bun:test"
import {
  parseKicadSymToCircuitJson,
  enhanceCircuitJsonWithKicadSym,
} from "src/parse-kicad-sym-to-circuit-json"
import { parseKicadModToCircuitJson } from "src/parse-kicad-mod-to-circuit-json"
import fs from "node:fs"
import path from "node:path"

// --------------------------------------------------------------------------
// Minimal inline symbol (no library wrapper)
// --------------------------------------------------------------------------
const SIMPLE_SYM = `(symbol "TestChip"
  (pin_names (offset 0))
  (symbol "TestChip_0_1"
    (pin passive line (at 0 0 0) (length 2.54)
      (name "IN" (effects (font (size 1.27 1.27))))
      (number "1" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 10 0 180) (length 2.54)
      (name "OUT" (effects (font (size 1.27 1.27))))
      (number "2" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 5 -5 90) (length 2.54)
      (name "GND" (effects (font (size 1.27 1.27))))
      (number "3" (effects (font (size 1.27 1.27))))
    )
    (pin passive line (at 5 5 270) (length 2.54)
      (name "VCC" (effects (font (size 1.27 1.27))))
      (number "4" (effects (font (size 1.27 1.27))))
    )
  )
)`

test("parseKicadSymToCircuitJson: basic four-sided pin placement", async () => {
  const cj = await parseKicadSymToCircuitJson(SIMPLE_SYM)

  const sc = cj.find((x: any) => x.type === "schematic_component") as any
  expect(sc).toBeTruthy()

  // Pin 1 at rotation=0 → left side
  expect(sc.schPortArrangement.leftSide).toContain("1")
  // Pin 2 at rotation=180 → right side
  expect(sc.schPortArrangement.rightSide).toContain("2")
  // Pin 3 at rotation=90 → bottom side
  expect(sc.schPortArrangement.bottomSide).toContain("3")
  // Pin 4 at rotation=270 → top side
  expect(sc.schPortArrangement.topSide).toContain("4")

  // pinLabels
  expect(sc.pinLabels["1"]).toBe("IN")
  expect(sc.pinLabels["2"]).toBe("OUT")
  expect(sc.pinLabels["3"]).toBe("GND")
  expect(sc.pinLabels["4"]).toBe("VCC")

  // Source / schematic ports
  const sourcePorts = cj.filter((x: any) => x.type === "source_port")
  const schPorts = cj.filter((x: any) => x.type === "schematic_port")
  expect(sourcePorts).toHaveLength(4)
  expect(schPorts).toHaveLength(4)

  // Source component name
  const comp = cj.find((x: any) => x.type === "source_component") as any
  expect(comp?.name).toBe("TestChip")
})

test("parseKicadSymToCircuitJson: numeric pin_number assigned for integer pins", async () => {
  const cj = await parseKicadSymToCircuitJson(SIMPLE_SYM)
  const sp1 = (cj as any[]).find(
    (x: any) => x.type === "source_port" && x.name === "1",
  )
  expect(sp1?.pin_number).toBe(1)
})

test("parseKicadSymToCircuitJson: non-numeric pin number has no pin_number", async () => {
  const sym = `(symbol "IC"
    (symbol "IC_0_1"
      (pin input line (at 0 0 0) (length 2.54)
        (name "A0" (effects (font (size 1.27 1.27))))
        (number "A0" (effects (font (size 1.27 1.27))))
      )
    )
  )`
  const cj = await parseKicadSymToCircuitJson(sym)
  const sp = (cj as any[]).find(
    (x: any) => x.type === "source_port" && x.name === "A0",
  )
  expect(sp?.pin_number).toBeUndefined()
  expect(sp?.pin_label).toBe("A0")
})

// --------------------------------------------------------------------------
// kicad_symbol_lib wrapper (as shipped in KiCad library files)
// --------------------------------------------------------------------------
const LIB_SYM = `(kicad_symbol_lib
  (version 20211014)
  (generator kicad_symbol_editor)
  (symbol "Resistor"
    (pin_names (offset 0) hide)
    (symbol "Resistor_0_1"
      (pin passive line (at 0 0 0) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin passive line (at 10 0 180) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
    )
  )
)`

test("parseKicadSymToCircuitJson: parses kicad_symbol_lib wrapper correctly", async () => {
  const cj = await parseKicadSymToCircuitJson(LIB_SYM)

  const comp = cj.find((x: any) => x.type === "source_component") as any
  expect(comp?.name).toBe("Resistor")

  const sc = cj.find((x: any) => x.type === "schematic_component") as any
  expect(sc?.schPortArrangement?.leftSide).toContain("1")
  expect(sc?.schPortArrangement?.rightSide).toContain("2")
})

test("parseKicadSymToCircuitJson: empty sides are omitted from schPortArrangement", async () => {
  // All pins on left/right — no top or bottom
  const cj = await parseKicadSymToCircuitJson(LIB_SYM)
  const sc = cj.find((x: any) => x.type === "schematic_component") as any
  expect(sc?.schPortArrangement?.topSide).toBeUndefined()
  expect(sc?.schPortArrangement?.bottomSide).toBeUndefined()
})

// --------------------------------------------------------------------------
// enhanceCircuitJsonWithKicadSym: overlay sym data onto kicad_mod circuit JSON
// --------------------------------------------------------------------------
test("enhanceCircuitJsonWithKicadSym: adds schPortArrangement and pinLabels to schematic_component", async () => {
  const modContent = fs.readFileSync(
    path.join(__dirname, "data/Crystal_SMD_HC49-US.kicad_mod"),
    "utf8",
  )
  const baseCj = await parseKicadModToCircuitJson(modContent)

  // Verify baseline has no schPortArrangement
  const baseSc = baseCj.find(
    (x: any) => x.type === "schematic_component",
  ) as any
  expect(baseSc?.schPortArrangement).toBeUndefined()

  const mockSym = `(symbol "Crystal"
    (symbol "Crystal_0_1"
      (pin passive line (at 0 0 0) (length 2.54)
        (name "P1" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
      (pin passive line (at 10 0 180) (length 2.54)
        (name "P2" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))
      )
    )
  )`

  const enhanced = await enhanceCircuitJsonWithKicadSym(baseCj, mockSym)

  const sc = enhanced.find((x: any) => x.type === "schematic_component") as any
  expect(sc?.schPortArrangement?.leftSide).toContain("1")
  expect(sc?.schPortArrangement?.rightSide).toContain("2")
  expect(sc?.pinLabels?.["1"]).toBe("P1")
  expect(sc?.pinLabels?.["2"]).toBe("P2")

  // PCB elements should be unchanged
  const pcbPads = enhanced.filter((x: any) => x.type === "pcb_smtpad")
  const origPads = baseCj.filter((x: any) => x.type === "pcb_smtpad")
  expect(pcbPads).toHaveLength(origPads.length)
})

test("enhanceCircuitJsonWithKicadSym: updates source_port pin_label when pin name available", async () => {
  const modContent = fs.readFileSync(
    path.join(__dirname, "data/Crystal_SMD_HC49-US.kicad_mod"),
    "utf8",
  )
  const baseCj = await parseKicadModToCircuitJson(modContent)

  const mockSym = `(symbol "XTAL"
    (symbol "XTAL_0_1"
      (pin passive line (at 0 0 0) (length 2.54)
        (name "XTAL_IN" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))
      )
    )
  )`

  const enhanced = await enhanceCircuitJsonWithKicadSym(baseCj, mockSym)

  const sp = (enhanced as any[]).find(
    (x: any) => x.type === "source_port" && x.name === "1",
  )
  expect(sp?.pin_label).toBe("XTAL_IN")
  expect(sp?.port_hints).toContain("XTAL_IN")
})

test("enhanceCircuitJsonWithKicadSym: no-op when sym has no pins", async () => {
  const modContent = fs.readFileSync(
    path.join(__dirname, "data/Crystal_SMD_HC49-US.kicad_mod"),
    "utf8",
  )
  const baseCj = await parseKicadModToCircuitJson(modContent)

  const emptySym = `(symbol "Empty" (symbol "Empty_0_1"))`
  const result = await enhanceCircuitJsonWithKicadSym(baseCj, emptySym)
  expect(result).toBe(baseCj) // same reference — unchanged
})
