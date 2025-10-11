import { type EffectsObj, effects_def } from "./kicad-zod"

export const formatAttr = (val: any, attrKey: string) => {
  if (attrKey === "effects" && Array.isArray(val)) {
    // val = [ [ 'font', [ 'size', '1', '1' ], [ 'thickness', '0.2' ] ] ]
    const effectsObj: EffectsObj = {}
    for (const elm of val) {
      if (elm[0] === "font") {
        const fontObj: any = {}
        for (const fontElm of elm.slice(1)) {
          if (fontElm.length === 2) {
            fontObj[fontElm[0].valueOf()] = Number.parseFloat(
              fontElm[1].valueOf(),
            )
          } else {
            fontObj[fontElm[0].valueOf()] = fontElm
              .slice(1)
              .map((n: any) => Number.parseFloat(n.valueOf()))
          }
        }
        effectsObj.font = fontObj
      }
    }
    return effects_def.parse(effectsObj)
  }
  if (attrKey === "pts") {
    // val is like [ [ 'xy', -1.25, -0.625 ], [ 'xy', 1.25, -0.625 ], ... ]
    return val.map((xy_pair: any[]) =>
      xy_pair.slice(1).map((n: any) => Number.parseFloat(n.valueOf())),
    )
  }
  if (attrKey === "stroke") {
    const strokeObj: any = {}
    for (const strokeElm of val) {
      const strokePropKey = strokeElm[0].valueOf()
      strokeObj[strokePropKey] = formatAttr(strokeElm.slice(1), strokePropKey)
    }
    return strokeObj
  }
  if (
    attrKey === "at" ||
    attrKey === "size" ||
    attrKey === "start" ||
    attrKey === "mid" ||
    attrKey === "end" ||
    attrKey === "center"
  ) {
    // Some KiCad versions may include non-numeric flags like "unlocked" in
    // the (at ...) attribute. Filter out any non-numeric tokens before parsing.
    const nums = (Array.isArray(val) ? val : [val])
      .map((n: any) => n?.valueOf?.() ?? n)
      .filter(
        (v: any) =>
          typeof v === "number" ||
          (typeof v === "string" && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(v)),
      )
      .map((v: any) => (typeof v === "number" ? v : Number.parseFloat(v)))

    return nums
  }
  if (attrKey === "tags") {
    return val.map((n: any) => n.valueOf())
  }
  if (attrKey === "generator_version" || attrKey === "version") {
    return val[0].valueOf()
  }
  if (val.length === 2) {
    return val.valueOf()
  }
  if (attrKey === "uuid") {
    if (Array.isArray(val)) {
      return val[0].valueOf()
    }
    return val.valueOf()
  }
  if (/^[\d\.]+$/.test(val) && !Number.isNaN(Number.parseFloat(val))) {
    return Number.parseFloat(val)
  }
  if (Array.isArray(val) && val.length === 1) {
    return val[0].valueOf()
  }
  if (Array.isArray(val)) {
    return val.map((s) => s.valueOf())
  }
  return val
}

export const getAttr = (s: Array<any>, key: string) => {
  for (const elm of s) {
    if (Array.isArray(elm) && elm[0] === key) {
      return formatAttr(elm.slice(1), key)
    }
  }
}
