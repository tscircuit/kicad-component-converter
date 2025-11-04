import type { KicadModJson } from "./kicad-zod"
import type { AnyCircuitElement } from "circuit-json"
import Debug from "debug"
import { generateArcPath, getArcLength } from "./math/arc-utils"
import { makePoint } from "./math/make-point"
import type { EdgeSegment } from "./math/edge-segment"
import { findClosedPolygons } from "./math/find-closed-polygons"
import { polygonToPoints } from "./math/polygon-to-points"
import { getSilkscreenFontSizeFromFpTexts } from "./get-Silkscreen-Font-Size-From-Fp-Texts"

const degToRad = (deg: number) => (deg * Math.PI) / 180
const rotatePoint = (x: number, y: number, deg: number) => {
  const r = degToRad(deg)
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}
const getAxisAlignedRectFromPoints = (
  points: Array<{ x: number; y: number }>,
) => {
  const uniquePoints = [
    ...new Map(points.map((p) => [`${p.x},${p.y}`, p])).values(),
  ]

  if (uniquePoints.length !== 4) return null

  const xs = uniquePoints.map((p) => p.x)
  const ys = uniquePoints.map((p) => p.y)
  const uniqueXs = [...new Set(xs)]
  const uniqueYs = [...new Set(ys)]

  if (uniqueXs.length !== 2 || uniqueYs.length !== 2) return null

  const [minX, maxX] = uniqueXs.sort((a, b) => a - b)
  const [minY, maxY] = uniqueYs.sort((a, b) => a - b)

  if (
    minX === undefined ||
    maxX === undefined ||
    minY === undefined ||
    maxY === undefined
  ) {
    return null
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const fpPolyHasFill = (fill?: string) => {
  if (!fill) return false
  const normalized = fill.toLowerCase()
  return (
    normalized !== "no" && normalized !== "none" && normalized !== "outline"
  )
}

const getRotationDeg = (at: number[] | undefined) => {
  if (!at) return 0
  if (Array.isArray(at) && at.length >= 3 && typeof at[2] === "number") {
    return at[2] as number
  }
  return 0
}
const isNinetyLike = (deg: number) => {
  const n = ((deg % 360) + 360) % 360
  return n === 90 || n === 270
}

const debug = Debug("kicad-mod-converter")

export const convertKicadLayerToTscircuitLayer = (kicadLayer: string) => {
  const lowerLayer = kicadLayer.toLowerCase()
  switch (lowerLayer) {
    case "f.cu":
    case "f.fab":
    case "f.silks":
    case "edge.cuts":
      return "top"
    case "b.cu":
    case "b.fab":
    case "b.silks":
      return "bottom"
  }
}

export const convertKicadJsonToTsCircuitSoup = async (
  kicadJson: KicadModJson,
): Promise<AnyCircuitElement[]> => {
  const {
    fp_lines,
    fp_texts,
    fp_arcs,
    fp_circles,
    pads,
    properties,
    holes,
    fp_polys,
  } = kicadJson

  const circuitJson: AnyCircuitElement[] = []

  circuitJson.push({
    type: "source_component",
    source_component_id: "source_component_0",
    supplier_part_numbers: {},
  } as any)

  circuitJson.push({
    type: "schematic_component",
    schematic_component_id: "schematic_component_0",
    source_component_id: "source_component_0",
    center: { x: 0, y: 0 },
    rotation: 0,
    size: { width: 0, height: 0 },
  } as any)

  // Collect all unique port names from pads and holes
  const portNames = new Set<string>()
  for (const pad of pads) {
    if (pad.name) portNames.add(pad.name)
  }
  if (holes) {
    for (const hole of holes) {
      if (hole.name) portNames.add(hole.name)
    }
  }

  // Create source_port elements
  let sourcePortId = 0
  const portNameToSourcePortId = new Map<string, string>()
  for (const portName of portNames) {
    const source_port_id = `source_port_${sourcePortId++}`
    portNameToSourcePortId.set(portName, source_port_id)
    circuitJson.push({
      type: "source_port",
      source_port_id,
      source_component_id: "source_component_0",
      name: portName,
      port_hints: [portName],
    })
    circuitJson.push({
      type: "schematic_port",
      schematic_port_id: `schematic_port_${sourcePortId++}`,
      source_port_id,
      schematic_component_id: "schematic_component_0",
      center: { x: 0, y: 0 },
    })
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
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
  const pcb_component_id = "pcb_component_0"

  circuitJson.push({
    type: "pcb_component",
    source_component_id: "source_component_0",
    pcb_component_id,
    layer: "top",
    center: { x: 0, y: 0 },
    rotation: 0,
    width: Number.isFinite(minX) ? maxX - minX : 0,
    height: Number.isFinite(minY) ? maxY - minY : 0,
  } as any)

  // Create pcb_port elements
  let pcbPortId = 0
  const portNameToPcbPortId = new Map<string, string>()
  for (const portName of portNames) {
    const pcb_port_id = `pcb_port_${pcbPortId++}`
    const source_port_id = portNameToSourcePortId.get(portName)!
    portNameToPcbPortId.set(portName, pcb_port_id)

    // Find the position from the first pad/hole with this name
    let x = 0
    let y = 0
    let layers: string[] = ["top", "bottom"]

    const pad = pads.find((p) => p.name === portName)
    if (pad) {
      x = pad.at[0]
      y = -pad.at[1]
      layers = pad.layers
        ? (pad.layers
            .map((l) => convertKicadLayerToTscircuitLayer(l))
            .filter(Boolean) as string[])
        : ["top", "bottom"]
    } else if (holes) {
      const hole = holes.find((h) => h.name === portName)
      if (hole) {
        x = hole.at[0]
        y = -hole.at[1]
        layers = hole.layers
          ? (hole.layers
              .map((l) => convertKicadLayerToTscircuitLayer(l))
              .filter(Boolean) as string[])
          : ["top", "bottom"]
      }
    }

    circuitJson.push({
      type: "pcb_port",
      pcb_port_id,
      source_port_id,
      pcb_component_id,
      x,
      y,
      layers,
    } as any)
  }

  let smtpadId = 0
  let platedHoleId = 0
  let holeId = 0
  for (const pad of pads) {
    if (pad.pad_type === "smd") {
      const pcb_port_id = pad.name
        ? portNameToPcbPortId.get(pad.name)
        : undefined
      circuitJson.push({
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
        pcb_port_id,
      } as any)
    } else if (pad.pad_type === "thru_hole") {
      if (pad.pad_shape === "rect") {
        const rotation = getRotationDeg(pad.at as any)
        const width = isNinetyLike(rotation) ? pad.size[1] : pad.size[0]
        const height = isNinetyLike(rotation) ? pad.size[0] : pad.size[1]
        const offX = pad.drill?.offset?.[0] ?? 0
        const offY = pad.drill?.offset?.[1] ?? 0
        const rotOff = rotatePoint(offX, offY, rotation)
        const pcb_port_id = pad.name
          ? portNameToPcbPortId.get(pad.name)
          : undefined
        circuitJson.push({
          type: "pcb_plated_hole",
          pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
          shape: "circular_hole_with_rect_pad",
          hole_shape: "circle",
          pad_shape: "rect",
          // x/y are the pad center; hole_offset_* positions the hole
          x: pad.at[0],
          y: -pad.at[1],
          hole_offset_x: rotOff.x,
          hole_offset_y: -rotOff.y,
          hole_diameter: pad.drill?.width!,
          rect_pad_width: width,
          rect_pad_height: height,
          layers: ["top", "bottom"],
          pcb_component_id,
          port_hints: [pad.name],
          pcb_port_id,
        } as any)
      } else if (pad.pad_shape === "circle") {
        const pcb_port_id = pad.name
          ? portNameToPcbPortId.get(pad.name)
          : undefined
        circuitJson.push({
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
          pcb_port_id,
        } as any)
      } else if (pad.pad_shape === "oval") {
        const pcb_port_id = pad.name
          ? portNameToPcbPortId.get(pad.name)
          : undefined
        circuitJson.push({
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
          port_hints: [pad.name],
          pcb_port_id,
        } as any)
      }
    } else if (pad.pad_type === "np_thru_hole") {
      circuitJson.push({
        type: "pcb_hole",
        pcb_hole_id: `pcb_hole_${holeId++}`,
        x: pad.at[0],
        y: -pad.at[1],
        hole_diameter: pad.drill?.width!,
        pcb_component_id,
      } as any)
    }
  }

  if (holes) {
    for (const hole of holes) {
      const hasCuLayer = hole.layers?.some(
        (l) => l.endsWith(".Cu") || l === "*.Cu",
      )

      const rotation = getRotationDeg(hole.at as any)
      const offX = hole.drill?.offset?.[0] ?? 0
      const offY = hole.drill?.offset?.[1] ?? 0
      const rotOff = rotatePoint(offX, offY, rotation)
      const x = hole.at[0] + rotOff.x
      const y = -(hole.at[1] + rotOff.y)
      const holeDiameter = hole.drill?.width ?? 0
      const outerDiameter = hole.size?.width ?? holeDiameter
      const rr = hole.roundrect_rratio ?? 0
      const rectBorderRadius =
        rr > 0
          ? (Math.min(
              isNinetyLike(rotation)
                ? (hole.size?.height ?? outerDiameter)
                : (hole.size?.width ?? outerDiameter),
              isNinetyLike(rotation)
                ? (hole.size?.width ?? outerDiameter)
                : (hole.size?.height ?? outerDiameter),
            ) /
              2) *
            rr
          : 0
      if (hasCuLayer) {
        if (hole.pad_shape === "rect") {
          const pcb_port_id = hole.name
            ? portNameToPcbPortId.get(hole.name)
            : undefined
          circuitJson.push({
            type: "pcb_plated_hole",
            pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
            shape: "circular_hole_with_rect_pad",
            hole_shape: "circle",
            pad_shape: "rect",
            // x/y are the pad center; hole_offset_* positions the hole
            x: hole.at[0],
            y: -hole.at[1],
            hole_offset_x: rotOff.x,
            hole_offset_y: -rotOff.y,
            hole_diameter: holeDiameter,
            rect_pad_width: isNinetyLike(rotation)
              ? (hole.size?.height ?? outerDiameter)
              : (hole.size?.width ?? outerDiameter),
            rect_pad_height: isNinetyLike(rotation)
              ? (hole.size?.width ?? outerDiameter)
              : (hole.size?.height ?? outerDiameter),
            rect_border_radius: rectBorderRadius,
            port_hints: [hole.name],
            layers: ["top", "bottom"],
            pcb_component_id,
            pcb_port_id,
          } as any)
        } else if (hole.pad_shape === "oval") {
          const pcb_port_id = hole.name
            ? portNameToPcbPortId.get(hole.name)
            : undefined
          circuitJson.push({
            type: "pcb_plated_hole",
            pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
            shape: "pill",
            x,
            y,
            outer_width: isNinetyLike(rotation)
              ? (hole.size?.height ?? outerDiameter)
              : (hole.size?.width ?? outerDiameter),
            outer_height: isNinetyLike(rotation)
              ? (hole.size?.width ?? outerDiameter)
              : (hole.size?.height ?? outerDiameter),
            hole_width: isNinetyLike(rotation)
              ? (hole.drill?.height ?? holeDiameter)
              : (hole.drill?.width ?? holeDiameter),
            hole_height: isNinetyLike(rotation)
              ? (hole.drill?.width ?? holeDiameter)
              : (hole.drill?.height ?? holeDiameter),
            port_hints: [hole.name],
            layers: ["top", "bottom"],
            pcb_component_id,
            pcb_port_id,
          } as any)
        } else if (hole.pad_shape === "roundrect") {
          const pcb_port_id = hole.name
            ? portNameToPcbPortId.get(hole.name)
            : undefined
          const offX = hole.drill?.offset?.[0] ?? 0
          const offY = hole.drill?.offset?.[1] ?? 0
          const rotOff = rotatePoint(offX, offY, rotation)
          const width = isNinetyLike(rotation)
            ? (hole.size?.height ?? outerDiameter)
            : (hole.size?.width ?? outerDiameter)
          const height = isNinetyLike(rotation)
            ? (hole.size?.width ?? outerDiameter)
            : (hole.size?.height ?? outerDiameter)
          circuitJson.push({
            type: "pcb_plated_hole",
            pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
            shape: "circular_hole_with_rect_pad",
            hole_shape: "circle",
            pad_shape: "rect",
            x,
            y,
            hole_offset_x: rotOff.x,
            hole_offset_y: -rotOff.y,
            hole_diameter: holeDiameter,
            rect_pad_width: width,
            rect_pad_height: height,
            rect_border_radius: rectBorderRadius,
            port_hints: [hole.name],
            layers: ["top", "bottom"],
            pcb_component_id,
            pcb_port_id,
          } as any)
        } else {
          const pcb_port_id = hole.name
            ? portNameToPcbPortId.get(hole.name)
            : undefined
          circuitJson.push({
            type: "pcb_plated_hole",
            pcb_plated_hole_id: `pcb_plated_hole_${platedHoleId++}`,
            shape: "circle",
            x,
            y,
            outer_diameter: outerDiameter,
            hole_diameter: holeDiameter,
            port_hints: [hole.name],
            layers: ["top", "bottom"],
            pcb_component_id,
            pcb_port_id,
          })
        }
      } else {
        circuitJson.push({
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

  // Collect Edge.Cuts segments for closed polygon detection
  const edgeCutSegments: EdgeSegment[] = []

  for (const fp_line of fp_lines) {
    const lowerLayer = fp_line.layer.toLowerCase()
    if (lowerLayer === "edge.cuts") {
      edgeCutSegments.push({
        type: "line",
        start: { x: fp_line.start[0], y: fp_line.start[1] },
        end: { x: fp_line.end[0], y: fp_line.end[1] },
        strokeWidth: fp_line.stroke.width,
      })
    }
  }

  for (const fp_arc of fp_arcs) {
    const lowerLayer = fp_arc.layer.toLowerCase()
    if (lowerLayer === "edge.cuts") {
      edgeCutSegments.push({
        type: "arc",
        start: { x: fp_arc.start[0], y: fp_arc.start[1] },
        mid: { x: fp_arc.mid[0], y: fp_arc.mid[1] },
        end: { x: fp_arc.end[0], y: fp_arc.end[1] },
        strokeWidth: fp_arc.stroke.width,
      })
    }
  }

  // Detect closed polygons from Edge.Cuts segments
  const closedPolygons = findClosedPolygons(edgeCutSegments)

  // Create pcb_cutout elements for closed polygons
  let cutoutId = 0
  for (const polygon of closedPolygons) {
    const points = polygonToPoints(polygon)
    if (points.length >= 3) {
      circuitJson.push({
        type: "pcb_cutout",
        pcb_cutout_id: `pcb_cutout_${cutoutId++}`,
        shape: "polygon",
        points: points.map((p) => ({ x: p.x, y: -p.y })),
        pcb_component_id,
      } as any)
    }
  }

  let traceId = 0
  let silkPathId = 0
  let fabPathId = 0
  let noteLineId = 0
  for (const fp_line of fp_lines) {
    const route = [
      { x: fp_line.start[0], y: -fp_line.start[1] },
      { x: fp_line.end[0], y: -fp_line.end[1] },
    ]
    const lowerLayer = fp_line.layer.toLowerCase()
    if (lowerLayer === "f.cu") {
      circuitJson.push({
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${traceId++}`,
        pcb_component_id,
        layer: convertKicadLayerToTscircuitLayer(fp_line.layer)!,
        route,
        thickness: fp_line.stroke.width,
      } as any)
    } else if (lowerLayer === "f.silks") {
      circuitJson.push({
        type: "pcb_silkscreen_path",
        pcb_silkscreen_path_id: `pcb_silkscreen_path_${silkPathId++}`,
        pcb_component_id,
        layer: "top",
        route,
        stroke_width: fp_line.stroke.width,
      } as any)
    } else if (lowerLayer === "edge.cuts") {
      // Skip Edge.Cuts - they are handled as pcb_cutout elements above
      debug(
        "Skipping Edge.Cuts fp_line (converted to pcb_cutout)",
        fp_line.layer,
      )
    } else if (lowerLayer === "f.fab") {
      circuitJson.push({
        type: "pcb_fabrication_note_path",
        fabrication_note_path_id: `fabrication_note_path_${fabPathId++}`,
        pcb_component_id,
        layer: "top",
        route,
        stroke_width: fp_line.stroke.width,
        port_hints: [],
      } as any)
    } else if (lowerLayer.startsWith("user.")) {
      // Convert user-defined layers to pcb_note_line
      circuitJson.push({
        type: "pcb_note_line",
        pcb_note_line_id: `pcb_note_line_${noteLineId++}`,
        pcb_component_id,
        x1: fp_line.start[0],
        y1: -fp_line.start[1],
        x2: fp_line.end[0],
        y2: -fp_line.end[1],
        stroke_width: fp_line.stroke.width,
      } as any)
    } else {
      debug("Unhandled layer for fp_line", fp_line.layer)
    }
  }

  if (fp_polys) {
    for (const fp_poly of fp_polys) {
      const route: Array<{ x: number; y: number }> = []
      const pushRoutePoint = (point: { x: number; y: number }) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return
        }
        route.push(point)
      }
      for (const segment of fp_poly.pts) {
        if (Array.isArray(segment)) {
          pushRoutePoint({ x: segment[0], y: -segment[1] })
          continue
        }
        if (segment && typeof segment === "object" && "kind" in segment) {
          if (segment.kind === "arc") {
            const start = makePoint(segment.start)
            const mid = makePoint(segment.mid)
            const end = makePoint(segment.end)
            const arcLength = getArcLength(start, mid, end)
            const numPoints = Math.max(8, Math.ceil(arcLength))
            const adjustedNumPoints = Math.max(2, Math.ceil(arcLength / 0.1))
            const arcPoints = generateArcPath(
              start,
              mid,
              end,
              adjustedNumPoints,
            ).map((p) => ({
              x: p.x,
              y: -p.y,
            }))
            for (const point of arcPoints) {
              pushRoutePoint(point)
            }
          }
          continue
        }
      }
      const routePoints = route
      const isClosed =
        routePoints.length > 2 &&
        routePoints[0]!.x === routePoints[routePoints.length - 1]!.x &&
        routePoints[0]!.y === routePoints[routePoints.length - 1]!.y
      const polygonPoints = isClosed ? routePoints.slice(0, -1) : routePoints
      if (routePoints.length === 0) continue
      const strokeWidth = fp_poly.stroke?.width ?? 0
      if (fp_poly.layer.endsWith(".Cu")) {
        const rect = getAxisAlignedRectFromPoints(polygonPoints)
        if (rect) {
          circuitJson.push({
            type: "pcb_smtpad",
            pcb_smtpad_id: `pcb_smtpad_${smtpadId++}`,
            shape: "rect",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
            pcb_component_id,
          } as any)
        } else if (fpPolyHasFill(fp_poly.fill)) {
          if (polygonPoints.length >= 3) {
            circuitJson.push({
              type: "pcb_smtpad",
              pcb_smtpad_id: `pcb_smtpad_${smtpadId++}`,
              shape: "polygon",
              points: polygonPoints,
              layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
              pcb_component_id,
            } as any)
          } else if (polygonPoints.length >= 2) {
            circuitJson.push({
              type: "pcb_trace",
              pcb_trace_id: `pcb_trace_${traceId++}`,
              pcb_component_id,
              layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
              route: polygonPoints,
              thickness: strokeWidth,
            } as any)
          }
        } else if (polygonPoints.length >= 2) {
          circuitJson.push({
            type: "pcb_trace",
            pcb_trace_id: `pcb_trace_${traceId++}`,
            pcb_component_id,
            layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
            route: polygonPoints,
            thickness: strokeWidth,
          } as any)
        }
      } else if (fp_poly.layer.endsWith(".SilkS")) {
        circuitJson.push({
          type: "pcb_silkscreen_path",
          pcb_silkscreen_path_id: `pcb_silkscreen_path_${silkPathId++}`,
          pcb_component_id,
          layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
          route: routePoints,
          stroke_width: strokeWidth,
        } as any)
      } else if (fp_poly.layer.endsWith(".Fab")) {
        circuitJson.push({
          type: "pcb_fabrication_note_path",
          fabrication_note_path_id: `fabrication_note_path_${fabPathId++}`,
          pcb_component_id,
          layer: convertKicadLayerToTscircuitLayer(fp_poly.layer)!,
          route: polygonPoints,
          stroke_width: strokeWidth,
          port_hints: [],
        } as any)
      } else {
        debug("Unhandled layer for fp_poly", fp_poly.layer)
      }
    }
  }

  let notePathId = 0
  for (const fp_arc of fp_arcs) {
    const lowerLayer = fp_arc.layer.toLowerCase()

    // Skip Edge.Cuts - they are handled as pcb_cutout elements above
    if (lowerLayer === "edge.cuts") {
      debug("Skipping Edge.Cuts fp_arc (converted to pcb_cutout)", fp_arc.layer)
      continue
    }

    const start = makePoint(fp_arc.start)
    const mid = makePoint(fp_arc.mid)
    const end = makePoint(fp_arc.end)
    const arcLength = getArcLength(start, mid, end)

    const arcPoints = generateArcPath(start, mid, end, Math.ceil(arcLength))

    if (lowerLayer.startsWith("user.")) {
      circuitJson.push({
        type: "pcb_note_path",
        pcb_note_path_id: `pcb_note_path_${notePathId++}`,
        pcb_component_id,
        route: arcPoints.map((p) => ({ x: p.x, y: -p.y })),
        stroke_width: fp_arc.stroke.width,
      } as any)
      continue
    }

    const tscircuitLayer = convertKicadLayerToTscircuitLayer(fp_arc.layer)
    if (!tscircuitLayer) {
      debug("Unable to convert layer for fp_arc", fp_arc.layer)
      continue
    }

    circuitJson.push({
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: `pcb_silkscreen_path_${silkPathId++}`,
      layer: tscircuitLayer,
      pcb_component_id,
      route: arcPoints.map((p) => ({ x: p.x, y: -p.y })),
      stroke_width: fp_arc.stroke.width,
    } as any)
  }

  if (fp_circles) {
    for (const fp_circle of fp_circles) {
      const lowerLayer = fp_circle.layer.toLowerCase()

      const center = makePoint(fp_circle.center)
      const endPoint = makePoint(fp_circle.end)
      const radius = Math.sqrt(
        (endPoint.x - center.x) ** 2 + (endPoint.y - center.y) ** 2,
      )

      // Generate circle as a series of points
      const numPoints = Math.max(16, Math.ceil(2 * Math.PI * radius))
      const circlePoints: Array<{ x: number; y: number }> = []
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI
        circlePoints.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
        })
      }

      // Convert user-defined layers to pcb_note_path
      if (lowerLayer.startsWith("user.")) {
        circuitJson.push({
          type: "pcb_note_path",
          pcb_note_path_id: `pcb_note_path_${notePathId++}`,
          pcb_component_id,
          route: circlePoints.map((p) => ({ x: p.x, y: -p.y })),
          stroke_width: fp_circle.stroke.width,
        } as any)
      }
    }
  }

  for (const fp_text of fp_texts) {
    const layerRef = convertKicadLayerToTscircuitLayer(fp_text.layer)!

    if (fp_text.layer.endsWith(".SilkS")) {
      circuitJson.push({
        type: "pcb_silkscreen_text",
        layer: layerRef,
        font: "tscircuit2024",
        font_size: fp_text.effects?.font?.size[0] ?? 1,
        pcb_component_id,
        anchor_position: { x: fp_text.at[0], y: -fp_text.at[1] },
        anchor_alignment: "center",
        text: fp_text.text,
      } as any)
    } else if (fp_text.layer.endsWith(".Fab")) {
      circuitJson.push({
        type: "pcb_fabrication_note_text",
        layer: layerRef,
        font: "tscircuit2024",
        font_size: fp_text.effects?.font?.size[0] ?? 1,
        pcb_component_id,
        anchor_position: { x: fp_text.at[0], y: -fp_text.at[1] },
        anchor_alignment: "center",
        text: fp_text.text,
      } as any)
    } else {
      debug("Unhandled layer for fp_text", fp_text.layer)
    }
  }

  const refProp = properties.find((prop) => prop.key === "Reference")
  const valProp = properties.find((prop) => prop.key === "Value")
  const propFabTexts = [refProp, valProp].filter((p) => p && Boolean(p.val))
  for (const propFab of propFabTexts) {
    const at = propFab!.attributes.at
    if (!at) continue

    // Determine type based on layer attribute
    const propLayer = propFab!.attributes.layer?.toLowerCase()
    const isFabLayer = propLayer?.endsWith(".fab")

    const font_size = getSilkscreenFontSizeFromFpTexts(fp_texts)

    circuitJson.push({
      type: isFabLayer ? "pcb_fabrication_note_text" : "pcb_silkscreen_text",
      layer: "top",
      font: "tscircuit2024",
      font_size,
      pcb_component_id,
      anchor_position: { x: at[0], y: -at[1] },
      anchor_alignment: "center",
      text: propFab!.val,
    } as any)
  }

  return circuitJson as any
}
