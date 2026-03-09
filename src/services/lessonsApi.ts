const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL;

function buildUrl(path: string): string {
  const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
  return `${base}${path}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
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
  return requestJson<LessonApiResponse[]>('/lessons');
}

export async function fetchLessonCards(lessonId: string): Promise<LessonCardApiResponse[]> {
  const encoded = encodeURIComponent(lessonId);
  return requestJson<LessonCardApiResponse[]>(`/lessons/${encoded}/cards`);
}
