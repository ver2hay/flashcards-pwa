const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL;
const USE_MOCKS = !API_BASE_URL;

function buildUrl(path: string): string {
  const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
  return `${base}${path}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404 && path.endsWith('.json')) {
      console.error(
        `Mock data not found at ${path}. Add the file to public${path}.`
      );
    }
    const message = response.statusText || 'Request failed';
    throw new Error(`API ${response.status}: ${message}`);
  }

  return response.json() as Promise<T>;
}

export interface LessonApiResponse {
  id: string;
  name: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface LessonCardApiResponse {
  id: string;
  frontText: string;
  backText: string;
  createdAt?: string | number;
}

export async function fetchLessons(): Promise<LessonApiResponse[]> {
  const path = USE_MOCKS ? '/lessons.json' : '/lessons';
  return requestJson<LessonApiResponse[]>(path);
}

export async function fetchLessonCards(lessonId: string): Promise<LessonCardApiResponse[]> {
  const encoded = encodeURIComponent(lessonId);
  const path = USE_MOCKS
    ? `/lessons-${encoded}-cards.json`
    : `/lessons/${encoded}/cards`;
  return requestJson<LessonCardApiResponse[]>(path);
}
