// API key material. Tokens look like osk_<40 hex chars>; only the SHA-256
// hash is stored, so a leaked database cannot mint requests.

export const API_KEY_PREFIX = "osk_";

export const generateApiKey = () => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${API_KEY_PREFIX}${hex}`;
};

export const hashApiKey = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

// The short display form persisted next to the hash ("osk_3f9a…b2c1") so the
// settings UI can identify keys without ever seeing them again.
export const apiKeyDisplayPrefix = (token: string) =>
  `${token.slice(0, API_KEY_PREFIX.length + 4)}…${token.slice(-4)}`;
