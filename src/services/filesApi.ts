import { authHeaders, clearCloudToken } from '../features/cloud/cloudAuth';
import { buildApiUrl, isCloudApiConfigured } from './lessonsApi';

function handle401(status: number): void {
  if (status === 401) clearCloudToken();
}

export interface LessonFileMeta {
  id: string;
  lessonId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function mergeAuth(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const extra = authHeaders();
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
  return headers;
}

export async function listLessonFiles(lessonId: string): Promise<LessonFileMeta[]> {
  if (!isCloudApiConfigured) throw new Error('Cloud API not configured');
  const encoded = encodeURIComponent(lessonId);
  const response = await fetch(buildApiUrl(`/lessons/${encoded}/files`), {
    headers: mergeAuth({ Accept: 'application/json' }),
  });
  if (!response.ok) {
    handle401(response.status);
    throw new Error(`List files failed: ${response.status}`);
  }
  return response.json() as Promise<LessonFileMeta[]>;
}

export async function uploadLessonFile(lessonId: string, file: File): Promise<LessonFileMeta> {
  if (!isCloudApiConfigured) throw new Error('Cloud API not configured');
  const encoded = encodeURIComponent(lessonId);
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetch(buildApiUrl(`/lessons/${encoded}/files`), {
    method: 'POST',
    headers: mergeAuth(),
    body,
  });
  if (!response.ok) {
    handle401(response.status);
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<LessonFileMeta>;
}

export async function downloadLessonFile(lessonId: string, fileId: string): Promise<Blob> {
  if (!isCloudApiConfigured) throw new Error('Cloud API not configured');
  const e1 = encodeURIComponent(lessonId);
  const e2 = encodeURIComponent(fileId);
  const response = await fetch(buildApiUrl(`/lessons/${e1}/files/${e2}/download`), {
    headers: mergeAuth(),
  });
  if (!response.ok) {
    handle401(response.status);
    throw new Error(`Download failed: ${response.status}`);
  }
  return response.blob();
}
