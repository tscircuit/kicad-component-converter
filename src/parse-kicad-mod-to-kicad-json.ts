import parseSExpression from "s-expression"
import {
  attributes_def,
  hole_def,
  kicad_mod_json_def,
  pad_def,
  type FpArc,
  type FpLine,
  type FpText,
  type FpCircle,
  type FpPoly,
  type Hole,
  type KicadModJson,
  type Pad,
  type Property,
} from "./kicad-zod"
import { formatAttr, getAttr } from "./get-attr"
import Debug from "debug"

const debug = Debug("kicad-mod-converter")

export const parseKicadModToKicadJson = (fileContent: string): KicadModJson => {
  const kicadSExpr = parseSExpression(fileContent)

  const footprintName = kicadSExpr[1].valueOf()

  const topLevelAttributes: any = {}

  const simpleTopLevelAttributes = Object.entries(kicad_mod_json_def.shape)
    .filter(
      ([attributeKey, def]) =>
        def._def.typeName === "ZodString" || attributeKey === "tags",
    )
    .map(([attributeKey]) => attributeKey)
  for (const kicadSExprRow of kicadSExpr.slice(2)) {
    if (!simpleTopLevelAttributes.includes(kicadSExprRow[0])) continue

    const key = kicadSExprRow[0].valueOf()
    const val = formatAttr(kicadSExprRow.slice(1), key)
    topLevelAttributes[key] = val
  }

  const properties = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "property")
    .map((row: any) => {
      const key = row[1].valueOf()
      const val = row[2].valueOf()
      const attributes = attributes_def.parse(
        row.slice(3).reduce((acc: any, attrAr: any[]) => {
          const attrKey = attrAr[0].valueOf()
          acc[attrKey] = formatAttr(attrAr.slice(1), attrKey)
          return acc
        }, {} as any),
      )

      return {
        key,
        val,
        attributes,
      } as Property
    })

  const padRows = kicadSExpr.slice(2).filter((row: any[]) => row[0] === "pad")

  const pads: Array<Pad> = []

  for (const row of padRows) {
    const at = getAttr(row, "at")
    const size = getAttr(row, "size")
    const drill = getAttr(row, "drill")
    let layers = getAttr(row, "layers")
    if (Array.isArray(layers)) {
      layers = layers.map((layer) => layer.valueOf())
    } else if (typeof layers === "string") {
      layers = [layers]
    } else if (!layers) {
      layers = []
    }

    // Skip pads that do NOT include 'F.Cu' layer
    if (!layers.includes("F.Cu")) {
      debug(`Skipping pad without F.Cu layer: layers=${layers.join(", ")}`)
      continue
    }

    const roundrect_rratio = getAttr(row, "roundrect_rratio")
    const uuid = getAttr(row, "uuid")
    const padRaw = {
      name: row[1].valueOf(),
      pad_type: row[2].valueOf(),
      pad_shape: row[3].valueOf(),
      at,
      drill,
      size,
      layers,
      roundrect_rratio,
      uuid,
    }

    debug(`attempting to parse pad: ${JSON.stringify(padRaw, null, "  ")}`)
    pads.push(pad_def.parse(padRaw))
  }

  const fp_texts_rows = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "fp_text")

  const fp_texts: FpText[] = []

  for (const fp_text_row of fp_texts_rows) {
    const text = fp_text_row[2].valueOf()
    const at = getAttr(fp_text_row, "at")
    const layer = getAttr(fp_text_row, "layer")
    const uuid = getAttr(fp_text_row, "uuid")
    const effects = getAttr(fp_text_row, "effects")

    fp_texts.push({
      fp_text_type: "user",
      text,
      at,
      layer,
      uuid,
      effects,
    })
  }

  const fp_lines: FpLine[] = []

  const fp_lines_rows = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "fp_line")

  for (const fp_line_row of fp_lines_rows) {
    const start = getAttr(fp_line_row, "start")
    const end = getAttr(fp_line_row, "end")
    const stroke = getAttr(fp_line_row, "stroke")
    const layer = getAttr(fp_line_row, "layer")
    const uuid = getAttr(fp_line_row, "uuid")

    fp_lines.push({
      start,
      end,
      stroke,
      layer,
      uuid,
    })
  }

  const fp_arcs: FpArc[] = []
  const fp_arcs_rows = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "fp_arc")

  for (const fp_arc_row of fp_arcs_rows) {
    const start = getAttr(fp_arc_row, "start")
    const mid = getAttr(fp_arc_row, "mid")
    const end = getAttr(fp_arc_row, "end")
    const stroke = getAttr(fp_arc_row, "stroke")
    const layer = getAttr(fp_arc_row, "layer")
    const uuid = getAttr(fp_arc_row, "uuid")

    if (!start || !end || !mid || !stroke || !layer) {
      continue
    }

    fp_arcs.push({
      start,
      mid,
      end,
      stroke,
      layer,
      uuid,
    })
  }

  const fp_circles: FpCircle[] = []
  const fp_circles_rows = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "fp_circle")

  for (const fp_circle_row of fp_circles_rows) {
    const center = getAttr(fp_circle_row, "center")
    const end = getAttr(fp_circle_row, "end")
    const stroke = getAttr(fp_circle_row, "stroke")
    const fill = getAttr(fp_circle_row, "fill")
    const layer = getAttr(fp_circle_row, "layer")
    const uuid = getAttr(fp_circle_row, "uuid")

    if (!center || !end || !stroke || !layer) {
      continue
    }

    fp_circles.push({
      center,
      end,
      stroke,
      fill,
      layer,
      uuid,
    })
  }

  const fp_polys: FpPoly[] = []
  const fp_polys_rows = kicadSExpr
    .slice(2)
    .filter((row: any[]) => row[0] === "fp_poly")

  for (const fp_poly_row of fp_polys_rows) {
    const pts = getAttr(fp_poly_row, "pts")
    const stroke = getAttr(fp_poly_row, "stroke")
    const layer = getAttr(fp_poly_row, "layer")
    const uuid = getAttr(fp_poly_row, "uuid")
    const fill = getAttr(fp_poly_row, "fill")

    fp_polys.push({
      pts,
      stroke,
      layer,
      uuid,
      fill,
    })
  }

  const holes: Hole[] = []

  for (const row of kicadSExpr.slice(2)) {
    if (row[0] !== "pad") continue
    if (row[2]?.valueOf?.() !== "thru_hole") continue

    const name = row[1]?.valueOf?.()
    const pad_type = row[2]?.valueOf?.()
    const pad_shape = row[3]?.valueOf?.()

    const at = getAttr(row, "at")
    const drill = getAttr(row, "drill")

    // ---- FIX: normalize size ----
    let size = getAttr(row, "size")
    if (Array.isArray(size)) {
      // remove "size" token if present
      if (size[0] === "size") size = size.slice(1)
      size = {
        width: Number(size[0]),
        height: Number(size[1]),
      }
    }

    const uuid = getAttr(row, "uuid")
    const roundrect_rratio = getAttr(row, "roundrect_rratio")

    let layers = getAttr(row, "layers")
    if (Array.isArray(layers)) {
      layers = layers.map((layer) => layer.valueOf())
    } else if (typeof layers === "string") {
      layers = [layers]
    } else if (!layers) {
      layers = []
    }

    const holeRaw = {
      name,
      pad_type,
      pad_shape,
      at,
      drill,
      size,
      layers,
      roundrect_rratio,
      uuid,
    }

    debug(`attempting to parse holes: ${JSON.stringify(holeRaw, null, 2)}`)
    holes.push(hole_def.parse(holeRaw))
  }

  return kicad_mod_json_def.parse({
    footprint_name: footprintName,
    ...topLevelAttributes,
    properties,
    fp_lines,
    fp_texts,
    fp_arcs,
    fp_circles,
    pads,
    holes,
    fp_polys,
  })
}
