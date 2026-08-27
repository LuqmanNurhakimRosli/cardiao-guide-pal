/**
 * PINRR — Percentage of INR readings in Therapeutic Range (2.0–3.0).
 * Calculates proportion of INR readings within therapeutic range in the
 * 12 months prior to the index encounter date.
 */
import type { DatedValue } from "./types";
import { CLINICAL_RULES } from "./ruleManifest";

export interface PinrrResult {
  percentage?: number;
  count: number;
  dateStart?: string;
  dateEnd?: string;
}

export function calculatePinrr(
  results: DatedValue<number>[] | undefined,
  indexDate: string = "2026-08-26",
): PinrrResult {
  if (!results || results.length === 0) return { count: 0 };

  const end = new Date(`${indexDate}T23:59:59Z`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1); // 12 months prior

  const eligible = results
    .filter((result) => {
      const date = new Date(`${result.date}T00:00:00Z`);
      return !isNaN(date.getTime()) && date >= start && date <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (eligible.length < CLINICAL_RULES.pinrr.minimumReadings) {
    return { count: eligible.length };
  }

  const inRange = eligible.filter(
    ({ value }) =>
      value >= CLINICAL_RULES.pinrr.lowerTherapeutic &&
      value <= CLINICAL_RULES.pinrr.upperTherapeutic,
  ).length;

  return {
    percentage: Math.round((inRange / eligible.length) * 100),
    count: eligible.length,
    dateStart: eligible[0]?.date,
    dateEnd: eligible[eligible.length - 1]?.date,
  };
}

/** Legacy undated helper */
export function pinrr(inrHistory: number[] | undefined): number | undefined {
  if (!inrHistory || inrHistory.length < 2) return undefined;
  const inRange = inrHistory.filter((v) => v >= 2 && v <= 3).length;
  return Math.round((inRange / inrHistory.length) * 100);
}
