/**
 * Runtime configuration for the CDSS frontend.
 * Kept intentionally minimal so it can be swapped for a config service later.
 */
export const CDSS_ENGINE_VERSION = "1.2.0";

export const cdssConfig = {
  /** Base URL for the CDSS API. Empty = same-origin TanStack server route. */
  apiBaseUrl: (import.meta.env.VITE_CDSS_API_URL as string | undefined) ?? "",
  /**
   * Persist clinician drafts + last response in localStorage.
   * Disabled in production by default: real deployments must not store PHI
   * in the browser. Enable explicitly with VITE_CDSS_PERSIST_DRAFTS=1.
   */
  persistDrafts:
    (import.meta.env.VITE_CDSS_PERSIST_DRAFTS as string | undefined) === "1" ||
    !import.meta.env.PROD,
  /** Debounce (ms) between draft edits and the live-preview API call. */
  draftDebounceMs: 300,
};
