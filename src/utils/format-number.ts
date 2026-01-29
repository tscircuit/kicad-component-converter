export function formatNumber(n: number): string {
  const rounded = Math.round(n * 10000) / 10000
  return rounded.toString()
}
