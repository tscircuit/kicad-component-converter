export function getSilkscreenFontSizeFromFpTexts(
  fp_texts: any[],
): number | null {
  if (!Array.isArray(fp_texts)) return null

  // Find the text used for the reference on F.SilkS (front silkscreen)
  const refText = fp_texts.find(
    (t) =>
      t.layer?.toLowerCase() === "f.silks" &&
      (t.text?.includes("${REFERENCE}") ||
        t.fp_text_type?.toLowerCase() === "reference" ||
        t.text?.match(/^R\d+|C\d+|U\d+/)),
  )

  // Fall back to F.Fab reference if no silkscreen reference found
  const fallbackText =
    refText ||
    fp_texts.find(
      (t) =>
        t.layer?.toLowerCase() === "f.fab" &&
        (t.text?.includes("${REFERENCE}") ||
          t.fp_text_type?.toLowerCase() === "reference"),
    )

  const target = refText || fallbackText
  if (!target?.effects?.font?.size) return null

  const [width, height] = target.effects.font.size
  return height ?? width ?? 1.0 // KiCad uses height for text height
}
