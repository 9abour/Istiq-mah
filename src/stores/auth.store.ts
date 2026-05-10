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
const TOKEN_SESSION_KEY = "istiqamah_gtoken";

// Error codes where the user intentionally closed/cancelled — not surfaced as errors
const SILENT_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

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

function readSessionToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(TOKEN_SESSION_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  googleAccessToken: readSessionToken(),
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
      if (token && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(TOKEN_SESSION_KEY, token);
      }
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
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(TOKEN_SESSION_KEY);
      }
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
      set((s) => ({
        user,
        loading: false,
        // Keep the Google access token if user is still signed in,
        // clear it only on sign-out
        googleAccessToken: user ? s.googleAccessToken : null,
      }));
      if (!user && typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(TOKEN_SESSION_KEY);
      }
    });
    return unsubscribe;
  },
}));
