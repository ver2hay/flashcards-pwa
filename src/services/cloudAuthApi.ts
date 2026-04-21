const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
  ?.VITE_API_BASE_URL;

export const isCloudApiConfigured = Boolean(API_BASE_URL);

function buildUrl(path: string): string {
  const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
  return `${base}${path}`;
}

export async function registerOnCloud(
  username: string,
  password: string
): Promise<{ token: string }> {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
  const response = await fetch(buildUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Register failed: ${response.status}`);
  }
  return response.json() as Promise<{ token: string }>;
}

export async function loginToCloud(
  username: string,
  password: string
): Promise<{ token: string }> {
  if (!isCloudApiConfigured) {
    throw new Error('Cloud API not configured');
  }
  const response = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Login failed: ${response.status}`);
  }
  return response.json() as Promise<{ token: string }>;
}
