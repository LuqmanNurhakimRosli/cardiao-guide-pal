import type { EmrAdapter } from "./types";

/**
 * UNIMED (Hospital UiTM) adapter — stub.
 *
 * Production integration steps:
 *   1. Set UNIMED_BASE_URL, UNIMED_CLIENT_ID, UNIMED_CLIENT_SECRET env vars.
 *   2. Implement OAuth2 client-credentials flow (token caching).
 *   3. Map UNIMED patient JSON → src/cdss/types Patient shape.
 *   4. Handle ICD-10/11 code normalisation and unit conversions.
 */
export const unimedAdapter: EmrAdapter = {
  name: "unimed",
  async getPatient(_id) {
    throw new Error(
      "UNIMED adapter not yet implemented. See docs/unimed-integration.md.",
    );
  },
  async listPatients() {
    throw new Error("UNIMED adapter not yet implemented.");
  },
};
