const TOKEN_KEY = 'flashcards.cloudToken';

export function getCloudToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setCloudToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearCloudToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getCloudToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
