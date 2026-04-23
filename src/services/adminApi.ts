import { buildApiUrl, isCloudApiConfigured } from './lessonsApi';
import { authHeaders, clearCloudToken } from '../features/cloud/cloudAuth';

export type UserRole = 'admin' | 'user';

export interface AdminUserRow {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
}

function ensureConfigured(): void {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  ensureConfigured();
  const url = buildApiUrl(path);
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) clearCloudToken();
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Запрос завершился с кодом ${response.status}`
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  return authJson<AdminUserRow[]>('/admin/users');
}

export async function createAdminUser(
  email: string,
  password: string,
  role: UserRole
): Promise<AdminUserRow> {
  return authJson<AdminUserRow>('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
}

export async function setUserRole(userId: string, role: UserRole): Promise<AdminUserRow> {
  return authJson<AdminUserRow>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await authJson<{ ok: boolean }>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function putPublicLessonsOrder(orderedIds: string[]): Promise<void> {
  await authJson<{ ok: boolean }>('/admin/lessons/public-order', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}
