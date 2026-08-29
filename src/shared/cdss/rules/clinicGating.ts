import type { Patient } from "../types";

export const ALLOWED_CLINICS = [
  "Cardiology Clinic",
  "Family Medicine Clinic",
  "PCM Clinic",
  "Primary Care Clinic",
  "Primary Care Medicine",
  "Klinik Pakar Perubatan Keluarga",
  "General Medicine Clinic",
];

export function isClinicEligible(p: Patient): boolean {
  if (!p.clinic_location) return true; // Default allow if unspecified
  const loc = p.clinic_location.toLowerCase();

  // Allow direct list matches
  if (ALLOWED_CLINICS.some((c) => c.toLowerCase() === loc)) return true;

  // Flexible alias matching (PCM, Family Medicine, Cardiology, Primary Care)
  const isMatch =
    loc.includes("cardio") ||
    loc.includes("family") ||
    loc.includes("pcm") ||
    loc.includes("primary care") ||
    loc.includes("fms") ||
    loc.includes("perubatan keluarga") ||
    loc.includes("klinik kesihatan") ||
    loc.includes("outpatient");

  return isMatch;
}

export function clinicGateReason(p: Patient): string {
  return `AF-CDSS inactive for ${p.clinic_location}. Enabled in: Cardiology Clinic, Family Medicine Clinic, PCM Clinic, Primary Care Clinic.`;
}
