/**
 * Runtime configuration for the CDSS frontend.
 * Kept intentionally minimal so it can be swapped for a config service later.
 */
export const CDSS_ENGINE_VERSION = "2.0.0";

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

export const cdssConfig = {
  /** Base URL for the CDSS API. Empty = same-origin TanStack server route. */
  apiBaseUrl: ((env as any).VITE_CDSS_API_URL as string | undefined) ?? "",
  /**
   * Persist clinician drafts + last response in localStorage.
   * Disabled in production by default: real deployments must not store PHI
   * in the browser. Enable explicitly with VITE_CDSS_PERSIST_DRAFTS=1.
   */
  persistDrafts:
    ((env as any).VITE_CDSS_PERSIST_DRAFTS as string | undefined) === "1" ||
    !(env as any).PROD,
  /** Debounce (ms) between draft edits and the live-preview API call. */
  draftDebounceMs: 300,
};
