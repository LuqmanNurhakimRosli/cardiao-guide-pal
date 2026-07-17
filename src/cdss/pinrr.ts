/**
 * PINRR — Percentage of INR readings in Therapeutic Range (2.0–3.0).
 * Simple linear proportion (not Rosendaal). Used to flag suboptimal
 * warfarin control when <55%.
 */
export function pinrr(inrHistory: number[] | undefined): number | undefined {
  if (!inrHistory || inrHistory.length === 0) return undefined;
  const inRange = inrHistory.filter((v) => v >= 2 && v <= 3).length;
  return Math.round((inRange / inrHistory.length) * 100);
}
