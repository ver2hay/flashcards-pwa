const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL;
const USE_MOCKS = !API_BASE_URL;
export const isCloudApiConfigured = Boolean(API_BASE_URL);

function buildUrl(path: string): string {
  const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
  return `${base}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildUrl(path);
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, {
    ...init,
    headers,
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

export interface CreateLessonPayload {
  name: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface LessonCardApiResponse {
  id: string;
  frontText: string;
  backText: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export async function createLesson(
  payload: CreateLessonPayload
): Promise<LessonApiResponse> {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
  return requestJson<LessonApiResponse>('/lessons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createLessonCards(
  lessonId: string,
  cards: { frontText: string; backText: string; createdAt?: string | number; updatedAt?: string | number }[]
): Promise<LessonCardApiResponse[]> {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
  const encoded = encodeURIComponent(lessonId);
  return requestJson<LessonCardApiResponse[]>(`/lessons/${encoded}/cards`, {
    method: 'POST',
    body: JSON.stringify(cards),
  });
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
