/**
 * Typed Google API client for this app.
 *
 * Token strategy
 * ──────────────
 * Before every request we call the server-side `/api/google/token` route
 * which uses the googleapis OAuth2 client to exchange the stored Google
 * refresh token for a fresh access token (client_secret stays on the server).
 *
 * To avoid a server round-trip on every single Calendar call the token is
 * cached in memory for 55 minutes (Google tokens expire after 60 minutes).
 * On 401 the cache is invalidated and a fresh token is fetched immediately.
 */

import {
  readStoredRefreshToken,
  saveStoredRefreshToken,
  useAuthStore,
} from '../stores/auth.store';

const GOOGLE_API_BASE = 'https://www.googleapis.com';
const TOKEN_ENDPOINT = '/api/google/token';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes

// ── In-memory token cache ─────────────────────────────────────────────────────

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

function getCached(): string | null {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  cachedToken = null;
  return null;
}

function setCached(token: string) {
  cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
}

function invalidateCache() {
  cachedToken = null;
}

// ── In-flight guard (prevents duplicate refresh calls) ────────────────────────

let activeRefresh: Promise<string | null> | null = null;

// ── Error type ────────────────────────────────────────────────────────────────

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Get a valid Google access token, using the in-memory cache when possible.
 * On a miss (or after a 401) calls the server `/api/google/token` route.
 */
async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const cached = getCached();
    if (cached) return cached;
  }

  if (activeRefresh) return activeRefresh;

  activeRefresh = (async (): Promise<string | null> => {
    try {
      const refreshToken = readStoredRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { accessToken?: string; error?: string };
      if (!data.accessToken) return null;

      setCached(data.accessToken);
      useAuthStore.getState().setGoogleToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      activeRefresh = null;
    }
  })();

  return activeRefresh;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function googleFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new GoogleApiError('No Google access token available', 401);
  }

  const makeRequest = (t: string) =>
    fetch(`${GOOGLE_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

  let res = await makeRequest(token);

  // On 401 invalidate the cache and retry with a fresh token once
  if (res.status === 401) {
    invalidateCache();
    const fresh = await getAccessToken(true);
    if (fresh) {
      res = await makeRequest(fresh);
    }
  }

  return res;
}

// ── Error helper ──────────────────────────────────────────────────────────────

async function throwIfError(res: Response, context: string): Promise<void> {
  if (res.ok || res.status === 204) return;
  const body = await res.json().catch(() => null);
  const message =
    (body as { error?: { message?: string } } | null)?.error?.message ??
    res.statusText ??
    context;
  throw new GoogleApiError(message, res.status, body);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const googleApi = {
  /**
   * Store the Google provider_refresh_token so the server route can use it.
   * Call this once after login when Supabase gives you the token.
   */
  setRefreshToken(token: string) {
    saveStoredRefreshToken(token);
    invalidateCache(); // next request will fetch a fresh access token
  },

  async get<T>(path: string): Promise<T> {
    const res = await googleFetch(path, { method: 'GET' });
    await throwIfError(res, `GET ${path}`);
    return res.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await googleFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await throwIfError(res, `POST ${path}`);
    return res.json() as Promise<T>;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await googleFetch(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    await throwIfError(res, `PATCH ${path}`);
    return res.json() as Promise<T>;
  },

  async delete(path: string): Promise<void> {
    const res = await googleFetch(path, { method: 'DELETE' });
    if (res.status === 404) return; // already gone — idempotent
    await throwIfError(res, `DELETE ${path}`);
  },
};
