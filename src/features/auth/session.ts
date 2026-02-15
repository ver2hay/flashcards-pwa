const SESSION_KEY = 'flashcards.userId';

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionUserId(): void {
  localStorage.removeItem(SESSION_KEY);
}
