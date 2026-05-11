import { create } from "zustand";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../lib/firebase";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

// localStorage keys
const TOKEN_KEY = "istiqamah_gtoken";
const TOKEN_EXPIRY_KEY = "istiqamah_gtoken_exp";
// sessionStorage key kept only for one-time migration
const TOKEN_SESSION_KEY = "istiqamah_gtoken";

// Refresh slightly before the real 3600-second Google expiry to avoid edge-case races
const TOKEN_TTL_MS = 55 * 60 * 1000;

// Error codes where the user intentionally closed/cancelled — not surfaced as errors
const SILENT_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

function readStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;

  // One-time migration: move any token left in sessionStorage into localStorage
  if (typeof sessionStorage !== "undefined") {
    const legacy = sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
      sessionStorage.removeItem(TOKEN_SESSION_KEY);
    }
  }

  const exp = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (exp && Date.now() > Number(exp)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

function saveStoredToken(token: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function clearStoredToken() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

interface AuthState {
  user: User | null;
  googleAccessToken: string | null;
  loading: boolean;      // true while onAuthStateChanged fires on mount
  signingIn: boolean;    // true while the OAuth popup is open
  authError: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
  initAuth: () => () => void;
}

function buildProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  return provider;
}


export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  googleAccessToken: readStoredToken(),
  loading: isFirebaseConfigured, // will be set to false once onAuthStateChanged fires
  signingIn: false,
  authError: null,
  configured: isFirebaseConfigured,

  signInWithGoogle: async () => {
    if (!auth) return;
    set({ signingIn: true, authError: null });
    try {
      const result = await signInWithPopup(auth, buildProvider());
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      if (token) saveStoredToken(token);
      set({ user: result.user, googleAccessToken: token, signingIn: false });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (!SILENT_CODES.has(code)) {
        const msg =
          code === "auth/popup-blocked"
            ? "Popup was blocked — please allow popups for this site and try again."
            : err instanceof Error
              ? err.message
              : "Sign-in failed. Please try again.";
        set({ authError: msg });
      }
      set({ signingIn: false });
    }
  },

  signOutUser: async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } finally {
      clearStoredToken();
      set({ user: null, googleAccessToken: null, authError: null });
    }
  },

  clearAuthError: () => set({ authError: null }),

  initAuth: () => {
    if (!auth) {
      set({ loading: false });
      return () => {};
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Re-read the token on every auth state change so expiry is re-evaluated
      const token = user ? readStoredToken() : null;
      if (!user) clearStoredToken();
      set({ user, loading: false, googleAccessToken: token });
    });
    return unsubscribe;
  },
}));
