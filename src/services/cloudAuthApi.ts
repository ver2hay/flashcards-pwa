import { buildApiUrl, isCloudApiConfigured } from './lessonsApi';
import { authHeaders, clearCloudToken } from '../features/cloud/cloudAuth';

export type CodePurpose = 'register' | 'reset';

export interface AuthTokenResponse {
  token: string;
  userId: string;
  email: string;
}

export type CloudUserRole = 'admin' | 'user';

export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  role?: CloudUserRole;
}

function ensureConfigured(): void {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
}

async function postJson<T>(path: string, body: unknown, auth = false): Promise<T> {
  ensureConfigured();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (auth) Object.assign(headers, authHeaders());
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401) clearCloudToken();
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Запрос завершился с кодом ${response.status}`
    );
  }
  return response.json() as Promise<T>;
}

export async function requestEmailCode(
  email: string,
  password: string,
  purpose: CodePurpose
): Promise<void> {
  await postJson('/auth/request-code', { email, password, purpose });
}

export async function verifyEmailCode(
  email: string,
  code: string,
  purpose: CodePurpose
): Promise<AuthTokenResponse> {
  return postJson<AuthTokenResponse>('/auth/verify-code', { email, code, purpose });
}

export async function loginToCloud(
  email: string,
  password: string
): Promise<AuthTokenResponse> {
  return postJson<AuthTokenResponse>('/auth/login', { email, password });
}

export async function fetchMe(): Promise<MeResponse> {
  ensureConfigured();
  const response = await fetch(buildApiUrl('/auth/me'), {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (response.status === 401) {
    clearCloudToken();
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    throw new Error(`Auth check failed: ${response.status}`);
  }
  return response.json() as Promise<MeResponse>;
}
