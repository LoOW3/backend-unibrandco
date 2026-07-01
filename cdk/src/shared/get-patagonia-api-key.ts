/**
 * Retrieves the Patagonia/DigipWMS API key from the PATAGONIA_API_KEY env var.
 */
export function getPatagoniaApiKey(): string {
  const apiKey = process.env.PATAGONIA_API_KEY;

  if (!apiKey) {
    throw new Error('Missing PATAGONIA_API_KEY environment variable');
  }

  return apiKey;
}
