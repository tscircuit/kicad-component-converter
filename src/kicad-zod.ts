import { z } from "zod";

export const point2 = z.tuple([z.coerce.number(), z.coerce.number()]);
export const point3 = z.tuple([z.number(), z.number(), z.number()]);
export const point = z.union([point2, point3]);

type MakeRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export const attributes_def = z
  .object({
    at: point,
    size: point2,
    layers: z.array(z.string()),
    roundrect_rratio: z.number(),
    uuid: z.string(),
  })
  .partial();

export const property_def = z.object({
  key: z.string(),
  val: z.string(),
  attributes: attributes_def,
});

const drill_def = z.object({
  oval: z.boolean().default(false),
  width: z.number().optional(),
  height: z.number().optional(),
  offset: point2.optional(),
});

export const pad_def = z.object({
  name: z.string(),
  pad_type: z.enum(["thru_hole", "smd", "np_thru_hole", "connect"]),
  pad_shape: z.enum([
    "roundrect",
    "circle",
    "rect",
    "oval",
    "trapezoid",
    "custom",
  ]),
  at: point,
  size: point2,
  drill: z
    .union([z.number(), z.array(z.any()), drill_def])
    .transform((a) => {
      if (typeof a === "number") {
        return { oval: false, width: a, height: a };
      }
      if ("oval" in a) return a;
      if (a.length === 2) {
        return {
          oval: false,
          width: Number.parseFloat(a[0]),
          height: Number.parseFloat(a[0]),
          offset: point2.parse(a[1].slice(1)),
        };
      }
      if (a.length === 3 || a.length === 4) {
        return {
          oval: a[0] === "oval",
          width: Number.parseFloat(a[1] as string),
          height: Number.parseFloat(a[2] as string),
          offset: a[3] ? point2.parse(a[3].slice(1)) : undefined,
        };
      }
      return a;
    })
    .pipe(drill_def)
    .optional(),
  layers: z.array(z.string()).optional(),
  roundrect_rratio: z.number().optional(),
  chamfer_ratio: z.number().optional(),
  solder_paste_margin: z.number().optional(),
  solder_paste_margin_ratio: z.number().optional(),
  clearance: z.number().optional(),
  zone_connection: z
    .union([
      z.literal(0).describe("Pad is not connect to zone"),
      z.literal(1).describe("Pad is connected to zone using thermal relief"),
      z.literal(2).describe("Pad is connected to zone using solid fill"),
    ])
    .optional(),
  thermal_width: z.number().optional(),
  thermal_gap: z.number().optional(),
  uuid: z.string().optional(),
});

export const effects_def = z
  .object({
    font: z.object({
      size: point2,
      thickness: z.number().optional(),
    }),
  })
  .partial();

export const fp_text_def = z.object({
  fp_text_type: z.literal("user"),
  text: z.string(),
  at: point,
  layer: z.string(),
  uuid: z.string().optional(),
  effects: effects_def.partial(),
});

export const fp_arc_def = z.object({
  start: point2,
  mid: point2,
  end: point2,
  stroke: z.object({
    width: z.number(),
    type: z.string(),
  }),
  layer: z.string(),
  uuid: z.string().optional(),
});

export const fp_line = z
  .object({
    start: point2,
    end: point2,
    stroke: z
      .object({
        width: z.number(),
        type: z.string(),
      })
      .optional(),
    width: z.number().optional(),
    layer: z.string(),
    uuid: z.string().optional(),
  })
  // Old kicad versions don't have "stroke"
  .transform((data) => {
    return {
      ...data,
      width: undefined,
      stroke: data.stroke ?? { width: data.width },
    } as MakeRequired<Omit<typeof data, "width">, "stroke">;
  });

export const kicad_mod_json_def = z.object({
  footprint_name: z.string(),
  version: z.string().optional(),
  generator: z.string().optional(),
  generator_version: z.string().optional(),
  layer: z.string(),
  descr: z.string().default(""),
  tags: z.array(z.string()).optional(),
  properties: z.array(property_def),
  fp_lines: z.array(fp_line),
  fp_texts: z.array(fp_text_def),
  fp_arcs: z.array(fp_arc_def),
  pads: z.array(pad_def),
});

// KiCad Symbol (.kicad_sym) definitions
export const pin_electrical_type = z.enum([
  "input",
  "output",
  "bidirectional",
  "tri_state",
  "passive",
  "free",
  "unspecified",
  "power_in",
  "power_out",
  "open_collector",
  "open_emitter",
  "no_connect",
]);

export const pin_graphic_style = z.enum([
  "line",
  "inverted",
  "clock",
  "inverted_clock",
  "input_low",
  "clock_low",
  "output_low",
  "edge_clock_high",
  "non_logic",
]);

export const symbol_pin_def = z.object({
  electrical_type: pin_electrical_type,
  graphic_style: pin_graphic_style,
  at: point,
  length: z.number(),
  name: z.string(),
  number: z.string(),
  name_effects: effects_def.optional(),
  number_effects: effects_def.optional(),
});

export const symbol_property_def = z.object({
  key: z.string(),
  value: z.string(),
  id: z.number(),
  at: point,
  effects: effects_def.optional(),
});

export const stroke_def = z.object({
  width: z.number(),
  type: z
    .enum(["dash", "dash_dot", "dash_dot_dot", "dot", "default", "solid"])
    .optional(),
  color: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const fill_def = z.object({
  type: z.enum(["none", "outline", "background"]),
});

export const symbol_arc_def = z.object({
  start: point2,
  mid: point2,
  end: point2,
  stroke: stroke_def,
  fill: fill_def.optional(),
});

export const symbol_circle_def = z.object({
  center: point2,
  radius: z.number(),
  stroke: stroke_def,
  fill: fill_def.optional(),
});

export const symbol_rectangle_def = z.object({
  start: point2,
  end: point2,
  stroke: stroke_def,
  fill: fill_def.optional(),
});

export const symbol_polyline_def = z.object({
  points: z.array(point2),
  stroke: stroke_def,
  fill: fill_def.optional(),
});

export const symbol_text_def = z.object({
  text: z.string(),
  at: point,
  effects: effects_def.optional(),
});

export const symbol_def = z.object({
  name: z.string(),
  extends: z.string().optional(),
  pin_numbers_hide: z.boolean().optional(),
  pin_names_hide: z.boolean().optional(),
  pin_names_offset: z.number().optional(),
  in_bom: z.boolean(),
  on_board: z.boolean(),
  properties: z.array(symbol_property_def),
  pins: z.array(symbol_pin_def),
  arcs: z.array(symbol_arc_def).optional(),
  circles: z.array(symbol_circle_def).optional(),
  rectangles: z.array(symbol_rectangle_def).optional(),
  polylines: z.array(symbol_polyline_def).optional(),
  texts: z.array(symbol_text_def).optional(),
  units: z.array(z.lazy(() => symbol_def)).optional(),
  unit_name: z.string().optional(),
});

export const kicad_sym_json_def = z.object({
  version: z.string(),
  generator: z.string(),
  symbols: z.array(symbol_def),
});

export type Point2 = z.infer<typeof point2>;
export type Point3 = z.infer<typeof point3>;
export type Point = z.infer<typeof point>;
export type Attributes = z.infer<typeof attributes_def>;
export type Property = z.infer<typeof property_def>;
export type Pad = z.infer<typeof pad_def>;
export type EffectsObj = z.infer<typeof effects_def>;
export type FpText = z.infer<typeof fp_text_def>;
export type FpLine = z.infer<typeof fp_line>;
export type FpArc = z.infer<typeof fp_arc_def>;
export type KicadModJson = z.infer<typeof kicad_mod_json_def>;

// KiCad Symbol types
export type PinElectricalType = z.infer<typeof pin_electrical_type>;
export type PinGraphicStyle = z.infer<typeof pin_graphic_style>;
export type SymbolPin = z.infer<typeof symbol_pin_def>;
export type SymbolProperty = z.infer<typeof symbol_property_def>;
export type StrokeDef = z.infer<typeof stroke_def>;
export type FillDef = z.infer<typeof fill_def>;
export type SymbolArc = z.infer<typeof symbol_arc_def>;
export type SymbolCircle = z.infer<typeof symbol_circle_def>;
export type SymbolRectangle = z.infer<typeof symbol_rectangle_def>;
export type SymbolPolyline = z.infer<typeof symbol_polyline_def>;
export type SymbolText = z.infer<typeof symbol_text_def>;
export type Symbol = z.infer<typeof symbol_def>;
export type KicadSymJson = z.infer<typeof kicad_sym_json_def>;
