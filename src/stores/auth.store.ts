import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
// Imported lazily to avoid circular dep — only used as a side-effect call
let _setApiRefreshToken: ((t: string) => void) | null = null;
async function notifyApiClient(token: string) {
  if (!_setApiRefreshToken) {
    const mod = await import('../services/google-api');
    _setApiRefreshToken = mod.googleApi.setRefreshToken.bind(mod.googleApi);
  }
  _setApiRefreshToken(token);
}

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

const TOKEN_KEY = 'istiqamah_gtoken';
const TOKEN_EXPIRY_KEY = 'istiqamah_gtoken_exp';
const REFRESH_TOKEN_KEY = 'istiqamah_grefresh';
// Refresh slightly before the real 3600-second Google expiry
const TOKEN_TTL_MS = 55 * 60 * 1000;

function readStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const exp = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (exp && Date.now() > Number(exp)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

function saveStoredToken(token: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function clearStoredToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function readStoredRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveStoredRefreshToken(token: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

interface AuthState {
  user: User | null;
  googleAccessToken: string | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
  initAuth: () => () => void;
  /** Called by the Google API client after a silent token refresh succeeds */
  setGoogleToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  googleAccessToken: readStoredToken(),
  loading: isSupabaseConfigured,
  signingIn: false,
  authError: null,
  configured: isSupabaseConfigured,

  signInWithGoogle: async () => {
    if (!supabase) return;
    set({ signingIn: true, authError: null });
    try {
      const redirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: CALENDAR_SCOPE,
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo,
        },
      });
      if (error) throw error;
      // Browser will redirect — signingIn stays true until the page navigates away
    } catch (err) {
      set({
        authError:
          err instanceof Error ? err.message : 'Sign-in failed. Please try again.',
        signingIn: false,
      });
    }
  },

  signOutUser: async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } finally {
      clearStoredToken();
      set({ user: null, googleAccessToken: null, authError: null });
    }
  },

  clearAuthError: () => set({ authError: null }),

  setGoogleToken: (token) => {
    saveStoredToken(token);
    set({ googleAccessToken: token });
  },

  initAuth: () => {
    if (!supabase) {
      set({ loading: false });
      return () => {};
    }

    // Hydrate from the persisted session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) saveStoredToken(session.provider_token);
      if (session?.provider_refresh_token) {
        saveStoredRefreshToken(session.provider_refresh_token);
        notifyApiClient(session.provider_refresh_token);
      }
      set({
        user: session?.user ?? null,
        loading: false,
        googleAccessToken: session?.provider_token ?? readStoredToken(),
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.provider_token) saveStoredToken(session.provider_token);
      if (session?.provider_refresh_token) {
        saveStoredRefreshToken(session.provider_refresh_token);
        notifyApiClient(session.provider_refresh_token);
      }
      if (!session) clearStoredToken();
      set({
        user: session?.user ?? null,
        googleAccessToken:
          session?.provider_token ?? (session ? readStoredToken() : null),
      });
    });

    return () => subscription.unsubscribe();
  },
}));
