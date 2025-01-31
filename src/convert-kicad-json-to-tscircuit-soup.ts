import type { KicadModJson } from "./kicad-zod"
import type { AnySoupElement } from "@tscircuit/soup"
import { createProjectBuilder } from "@tscircuit/builder"
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
  const { fp_lines, fp_texts, fp_arcs, pads, footprint_name, properties } =
    kicadJson

  const pb = createProjectBuilder()

  pb.add("component", (cb) => {
    for (const pad of pads) {
      if (pad.pad_type === "smd") {
        cb.footprint.add("smtpad", (pb) =>
          pb
            .setProps({
              x: pad.at[0],
              y: -pad.at[1],
              // ??? @tscircuit/builder bug? width and height are not recognized
              width: pad.size[0],
              height: pad.size[1],
              layer: pad.layers?.[0]! as any,
              shape: "rect",
              port_hints: [pad.name],
            })
            .setSize(pad.size[0], pad.size[1]),
        )
      } else if (pad.pad_type === "thru_hole") {
        if (pad.pad_shape === "circle") {
          cb.footprint.add("platedhole", (phb) =>
            phb.setProps({
              x: pad.at[0],
              y: -pad.at[1],
              outer_diameter: pad.size[0], // Assuming outer_diameter is the same as diameter for a circle
              hole_diameter: pad.drill?.width!,
              shape: "circle",
              // TODO kicad uses "*.Cu" and "*.Mask" to mean "every"
              layers: ["top", "bottom"],
              port_hints: [pad.name],
            }),
          )
        } else if (pad.pad_shape === "oval") {
          cb.footprint.add("platedhole", (phb) =>
            phb.setProps({
              shape: "pill",
              x: pad.at[0],
              y: -pad.at[1],
              outer_width: pad.size[0],
              outer_height: pad.size[1],
              hole_width: pad.drill?.width!,
              hole_height: pad.drill?.height!,
              // TODO kicad uses "*.Cu" and "*.Mask" to mean "every"
              layers: ["top", "bottom"],
              // port_hints: [pad.name],
            }),
          )
        }
      } else if (pad.pad_type === "np_thru_hole") {
        cb.footprint.add("hole", (hb) =>
          hb.setProps({
            x: pad.at[0],
            y: -pad.at[1],
            hole_diameter: pad.drill?.width!,
          }),
        )
      } else if (pad.pad_type === "connect") {
        // ???
      }
    }
    for (const fp_line of fp_lines) {
      if (fp_line.layer === "F.Cu") {
        cb.footprint.add("pcbtrace", (pb) =>
          pb.setProps({
            route: [
              { x: fp_line.start[0], y: -fp_line.start[1] },
              { x: fp_line.end[0], y: -fp_line.end[1] },
            ],
            layer: convertKicadLayerToTscircuitLayer(fp_line.layer),
            thickness: fp_line.stroke.width,
          }),
        )
      } else if (fp_line.layer === "F.SilkS") {
        cb.footprint.add("silkscreenpath", (lb) =>
          lb.setProps({
            route: [
              { x: fp_line.start[0], y: -fp_line.start[1] },
              { x: fp_line.end[0], y: -fp_line.end[1] },
            ],
            layer: "top",
          }),
        )
      } else if (fp_line.layer === "F.Fab") {
        cb.footprint.add("fabricationnotepath", (lb) =>
          lb.setProps({
            route: [
              { x: fp_line.start[0], y: -fp_line.start[1] },
              { x: fp_line.end[0], y: -fp_line.end[1] },
            ],
            layer: "top", //convertKicadLayerToTscircuitLayer(fp_line.layer),
          }),
        )
      } else {
        debug("Unhandled layer for fp_line", fp_line.layer)
      }
    }

    for (const fp_arc of fp_arcs) {
      const { stroke, layer } = fp_arc
      const start = makePoint(fp_arc.start)
      const mid = makePoint(fp_arc.mid)
      const end = makePoint(fp_arc.end)
      const arcLength = getArcLength(start, mid, end)

      const arcPoints = generateArcPath(start, mid, end, Math.ceil(arcLength))

      cb.footprint.add("silkscreenpath", (sp) =>
        sp.setProps({
          route: arcPoints.map((p) => ({ x: p.x, y: -p.y })),
          layer: convertKicadLayerToTscircuitLayer(layer)!,
        }),
      )
    }

    for (const fp_text of fp_texts) {
      cb.footprint.add("silkscreentext", (pb) =>
        pb.setProps({
          text: fp_text.text,
          pcbX: fp_text.at[0],
          pcbY: -fp_text.at[1],
          layer: convertKicadLayerToTscircuitLayer(fp_text.layer)!,
          fontSize: fp_text.effects?.font?.size[0],

          // TODO
          // rotation: fp_text.angle,
        }),
      )
    }

    // The reference property also becomes text
    const refProp = properties.find((prop) => prop.key === "Reference")
    const valProp = properties.find((prop) => prop.key === "Value")
    const propFabTexts = [refProp, valProp].filter((p) => p && Boolean(p.val))
    for (const propFab of propFabTexts) {
      const at = propFab!.attributes.at
      if (!at) continue
      cb.footprint.add("fabricationnotetext", (fnt) =>
        fnt.setProps({
          text: propFab!.val,
          pcbX: at[0],
          pcbY: -at[1],
          layer: "top",
          fontSize: 1.27,
        }),
      )
    }
  })

  const soup = await pb.build()

  return soup as any
}
