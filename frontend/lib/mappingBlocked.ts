/** Matches backend `MAPPING_BLOCKED_MESSAGE_RU` for UX (link to integrations). */

export function isAnalyticsMappingBlockedMessage(message: string): boolean {
  return message.includes("Аналитика временно недоступна");
}
