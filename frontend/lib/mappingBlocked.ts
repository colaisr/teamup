import type { ApiErrorWithCode } from "@/lib/api";

/**
 * Matches backend `ANALYTICS_MAPPINGS_INCOMPLETE_CODE` (`workspace_mapping_gate`) and legacy RU-only text.
 */
export const ANALYTICS_MAPPINGS_INCOMPLETE_CODE = "analytics_mappings_incomplete";

export function isAnalyticsMappingBlockedError(error: unknown): boolean {
  if (error && typeof error === "object" && error !== null) {
    const code = (error as ApiErrorWithCode).apiErrorCode;
    if (code === ANALYTICS_MAPPINGS_INCOMPLETE_CODE) return true;
  }
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return msg.includes("Аналитика временно недоступна");
}

/** @deprecated Prefer `isAnalyticsMappingBlockedError` with the caught `Error` from `api()`. */
export function isAnalyticsMappingBlockedMessage(message: string): boolean {
  return message.includes("Аналитика временно недоступна");
}
