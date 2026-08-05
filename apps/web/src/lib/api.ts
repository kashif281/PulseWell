const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export function getApiOrigin(): string {
  if (API_URL.startsWith('/')) {
    if (typeof window !== 'undefined') return window.location.origin;
    return process.env.FRONTEND_URL || 'http://localhost:4000';
  }
  return API_URL.replace(/\/api\/v1\/?$/, '');
}

interface FetchOptions extends RequestInit {
  token?: string;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { success?: boolean; data?: unknown; error?: string };
  } catch {
    throw new Error(`Invalid API response (${res.status})`);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const json = await parseJsonResponse(res);
  const data = json.data as { accessToken?: string; refreshToken?: string } | undefined;
  if (!res.ok || !data?.accessToken || !data?.refreshToken) {
    return null;
  }

  storeTokens(data.accessToken, data.refreshToken);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pulseai:tokens-updated', { detail: { accessToken: data.accessToken } }),
    );
  }
  return data.accessToken;
}

function notifySessionExpired() {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulseai:session-expired'));
  }
}

export async function api<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { token: tokenOption, ...fetchOptions } = options;
  let token = tokenOption ?? getStoredToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  let json = await parseJsonResponse(res);

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      });
      json = await parseJsonResponse(res);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      notifySessionExpired();
    }
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json as { success: boolean; data?: T; error?: string };
}

export async function uploadFile(
  endpoint: string,
  formData: FormData,
  token?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let authToken = token ?? getStoredToken();

  const doUpload = async (bearer: string | null) => {
    const headers: HeadersInit = {};
    if (bearer) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${bearer}`;
    }
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await parseJsonResponse(res);
    return { res, json };
  };

  let { res, json } = await doUpload(authToken);

  if (res.status === 401 && authToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      ({ res, json } = await doUpload(newToken));
    }
  }

  if (!res.ok) {
    if (res.status === 401 && authToken) {
      notifySessionExpired();
    }
    throw new Error(json.error || `Upload failed (${res.status})`);
  }
  return json as { success: boolean; data?: unknown; error?: string };
}

/** Authenticated binary download for medical/HR files (no public /uploads access). */
export async function downloadAuthenticatedFile(
  endpoint: string,
  token?: string,
  fileName = 'download',
): Promise<void> {
  let authToken = token ?? getStoredToken();

  const doFetch = async (bearer: string | null) => {
    const headers: HeadersInit = {};
    if (bearer) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${bearer}`;
    }
    return fetch(`${API_URL}${endpoint}`, { headers });
  };

  let res = await doFetch(authToken);
  if (res.status === 401 && authToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      authToken = newToken;
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && authToken) notifySessionExpired();
    throw new Error(`Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function storeUser(user: unknown) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function getStoredUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? (JSON.parse(raw) as T) : null;
}
