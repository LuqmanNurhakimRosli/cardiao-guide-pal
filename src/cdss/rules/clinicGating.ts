import type { Patient } from "../types";

export const ALLOWED_CLINICS = [
  "Cardiology Clinic",
  "Family Medicine Clinic",
];

export function isClinicEligible(p: Patient): boolean {
  return ALLOWED_CLINICS.includes(p.clinic_location);
}

export function clinicGateReason(p: Patient): string {
  return `AF-CDSS inactive for ${p.clinic_location}. Enabled only in: ${ALLOWED_CLINICS.join(", ")}.`;
}
