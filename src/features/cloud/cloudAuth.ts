/**
 * Cloud JWT storage. Kept in localStorage so the token survives
 * reloads, standalone PWA launches and offline periods.
 */
const TOKEN_KEY = 'flashcards.cloudToken';

export function getCloudToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setCloudToken(token: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCloudToken(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getCloudToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
