import type { KicadModJson } from "./kicad-zod"
import type { AnySoupElement } from "@tscircuit/soup"
import Debug from "debug"
import { generateArcPath, getArcLength } from "./math/arc-utils"
import { makePoint } from "./math/make-point"

const debug = Debug("kicad-mod-converter")

export const convertKicadLayerToTscircuitLayer = (kicadLayer: string) => {
  switch (kicadLayer) {
    case "F.Cu":
    case "F.Fab":
    case "F.SilkS":
      return "top"
    case "B.Cu":
    case "B.Fab":
    case "B.SilkS":
      return "bottom"
  }
}

export const convertKicadJsonToTsCircuitSoup = async (
  kicadJson: KicadModJson,
): Promise<AnySoupElement[]> => {
  const { fp_lines, fp_texts, fp_arcs, pads, properties, holes } = kicadJson

  const soup: AnySoupElement[] = []

  soup.push({
    type: "source_component",
    source_component_id: "generic_0",
    supplier_part_numbers: {},
  } as any)

  soup.push({
    type: "schematic_component",
    schematic_component_id: "schematic_generic_component_0",
    source_component_id: "generic_0",
    center: { x: 0, y: 0 },
    rotation: 0,
    size: { width: 0, height: 0 },
  } as any)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pad of pads) {
    const x = pad.at[0]
    const y = -pad.at[1]
    const w = pad.size[0]
    const h = pad.size[1]
    minX = Math.min(minX, x - w / 2)
    maxX = Math.max(maxX, x + w / 2)
    minY = Math.min(minY, y - h / 2)
    maxY = Math.max(maxY, y + h / 2)
  }
  const pcb_component_id = "pcb_generic_component_0"

  soup.push({
    type: "pcb_component",
    source_component_id: "generic_0",
    pcb_component_id,
    layer: "top",
    center: { x: 0, y: 0 },
    rotation: 0,
    width: isFinite(minX) ? maxX - minX : 0,
    height: isFinite(minY) ? maxY - minY : 0,
  } as any)

  let smtpadId = 0
  let platedHoleId = 0
  let holeId = 0
  for (const pad of pads) {
    if (pad.pad_type === "smd") {
      soup.push({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${smtpadId++}`,
        shape: "rect",
        x: pad.at[0],
        y: -pad.at[1],
        width: pad.size[0],
        height: pad.size[1],
        layer: convertKicadLayerToTscircuitLayer(pad.layers?.[0] ?? "F.Cu")!,
        pcb_component_id,
        port_hints: [pad.name],
      } as any)
    } else if (pad.pad_type === "thru_hole") {
      if (pad.pad_shape === "circle") {
        soup.push({
          type: "pcb_plated_hole",
          pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
          shape: "circle",
          x: pad.at[0],
          y: -pad.at[1],
          outer_diameter: pad.size[0],
          hole_diameter: pad.drill?.width!,
          layers: ["top", "bottom"],
          pcb_component_id,
          port_hints: [pad.name],
        } as any)
      } else if (pad.pad_shape === "oval") {
        soup.push({
          type: "pcb_plated_hole",
          pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
          shape: "pill",
          x: pad.at[0],
          y: -pad.at[1],
          outer_width: pad.size[0],
          outer_height: pad.size[1],
          hole_width: pad.drill?.width!,
          hole_height: pad.drill?.height!,
          layers: ["top", "bottom"],
          pcb_component_id,
        } as any)
      }
    } else if (pad.pad_type === "np_thru_hole") {
      soup.push({
        type: "pcb_hole",
        pcb_hole_id: `pcb_hole_${holeId++}`,
        x: pad.at[0],
        y: -pad.at[1],
        hole_diameter: pad.drill?.width!,
        pcb_component_id,
      } as any)
    }
  }
  console.log("Holes:", holes) // Debugging line, can be removed later

  if (holes) {
    for (const hole of holes) {
      const hasCuLayer = hole.layers?.some(
        (l) => l.endsWith(".Cu") || l === "*.Cu",
      )

      const x = hole.at[0]
      const y = -hole.at[1]
      const holeDiameter = hole.drill?.width ?? 0
      const outerDiameter = hole.size?.width ?? holeDiameter

      if (hasCuLayer) {
        soup.push({
          type: "pcb_plated_hole",
          pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
          shape: "circle",
          x,
          y,
          outer_diameter: outerDiameter,
          hole_diameter: holeDiameter,
          portHints: [hole.name],
          layers: ["top", "bottom"],
          pcb_component_id,
        } as any)
      } else {
        soup.push({
          type: "pcb_hole",
          pcb_hole_id: `pcb_hole_${holeId++}`,
          x,
          y,
          hole_diameter: outerDiameter,
          hole_shape: "circle",
          pcb_component_id,
        } as any)
      }
    }
  }

  let traceId = 0
  let silkPathId = 0
  let fabPathId = 0
  for (const fp_line of fp_lines) {
    const route = [
      { x: fp_line.start[0], y: -fp_line.start[1] },
      { x: fp_line.end[0], y: -fp_line.end[1] },
    ]
    if (fp_line.layer === "F.Cu") {
      soup.push({
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${traceId++}`,
        pcb_component_id,
        layer: convertKicadLayerToTscircuitLayer(fp_line.layer)!,
        route,
        thickness: fp_line.stroke.width,
      } as any)
    } else if (fp_line.layer === "F.SilkS") {
      soup.push({
        type: "pcb_silkscreen_path",
        pcb_silkscreen_path_id: `pcb_silkscreen_path_${silkPathId++}`,
        pcb_component_id,
        layer: "top",
        route,
        stroke_width: fp_line.stroke.width,
      } as any)
    } else if (fp_line.layer === "F.Fab") {
      soup.push({
        type: "pcb_fabrication_note_path",
        fabrication_note_path_id: `fabrication_note_path_${fabPathId++}`,
        pcb_component_id,
        layer: "top",
        route,
        stroke_width: fp_line.stroke.width,
        port_hints: [],
      } as any)
    } else {
      debug("Unhandled layer for fp_line", fp_line.layer)
    }
  }

  for (const fp_arc of fp_arcs) {
    const start = makePoint(fp_arc.start)
    const mid = makePoint(fp_arc.mid)
    const end = makePoint(fp_arc.end)
    const arcLength = getArcLength(start, mid, end)

    const arcPoints = generateArcPath(start, mid, end, Math.ceil(arcLength))

    soup.push({
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: `pcb_silkscreen_path_${silkPathId++}`,
      layer: convertKicadLayerToTscircuitLayer(fp_arc.layer)!,
      pcb_component_id,
      route: arcPoints.map((p) => ({ x: p.x, y: -p.y })),
      stroke_width: fp_arc.stroke.width,
    } as any)
  }

  for (const fp_text of fp_texts) {
    soup.push({
      type: "pcb_silkscreen_text",
      layer: convertKicadLayerToTscircuitLayer(fp_text.layer)!,
      font: "tscircuit2024",
      font_size: fp_text.effects?.font?.size[0] ?? 1,
      pcb_component_id,
      anchor_position: { x: fp_text.at[0], y: -fp_text.at[1] },
      anchor_alignment: "center",
      text: fp_text.text,
    } as any)
  }

  const refProp = properties.find((prop) => prop.key === "Reference")
  const valProp = properties.find((prop) => prop.key === "Value")
  const propFabTexts = [refProp, valProp].filter((p) => p && Boolean(p.val))
  for (const propFab of propFabTexts) {
    const at = propFab!.attributes.at
    if (!at) continue
    soup.push({
      type: "pcb_silkscreen_text",
      layer: "top",
      font: "tscircuit2024",
      font_size: 1.27,
      pcb_component_id,
      anchor_position: { x: at[0], y: -at[1] },
      anchor_alignment: "center",
      text: propFab!.val,
    } as any)
  }

  return soup as any
}
