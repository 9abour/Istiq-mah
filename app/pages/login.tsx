import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../src/stores/auth.store';
import '../../src/styles/Login.css';

const GoogleIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </svg>
);

const features = [
  {
    icon: '🕌',
    title: 'Prayer-anchored tasks',
    desc: 'Organise your day around Fajr, Dhuhr, Asr, Maghrib & Isha',
  },
  {
    icon: '⏱',
    title: 'Time-ranged todos',
    desc: 'Set exact time windows bounded by prayer times',
  },
  {
    icon: '📅',
    title: 'Google Calendar sync',
    desc: 'Push your todos to Google Calendar with one tap',
  },
  {
    icon: '☁️',
    title: 'Sync across devices',
    desc: 'Tasks stored securely under your Google account',
  },
];

const setupSteps = [
  { n: '1', text: 'Go to supabase.com, create a project, and enable Google under Authentication → Providers.' },
  { n: '2', text: 'In Google Cloud Console add your Supabase callback URL as an authorised redirect URI.' },
  { n: '3', text: 'Copy your Supabase URL and publishable key into a .env.local file at the project root.' },
  { n: '4', text: 'Run the todos table SQL from src/services/todos.service.ts in the Supabase SQL editor.' },
  { n: '5', text: 'Restart the dev server — the auth flow will appear automatically.' },
];

export default function LoginPage() {
  const {
    user,
    loading,
    configured,
    signingIn,
    authError,
    clearAuthError,
    signInWithGoogle,
    initAuth,
  } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = initAuth();
    return unsub;
  }, [initAuth]);

  // If already signed in → go home
  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  // ── Loading ring while Supabase resolves auth ──
  if (configured && loading) {
    return (
      <div className="lp">
        <div className="lp__glow" />
        <div className="lp__loading">
          <div className="lp__loading-ring" />
        </div>
      </div>
    );
  }

  return (
    <div className="lp">
      <div className="lp__glow" />
      <div className="lp__geo" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`lp__geo-ring lp__geo-ring--${i + 1}`} />
        ))}
      </div>

      <div className="lp__card">
        {/* Brand */}
        <div className="lp__brand">
          <img src="/logo.svg" alt="Istiqāmah" className="lp__logo" />
          <h1 className="lp__title">Istiqāmah</h1>
          <p className="lp__subtitle">Track your day — anchored by prayer</p>
        </div>

        {configured ? (
          /* ── Firebase ready → show sign-in ── */
          <>
            <div className="lp__signin">
              <button
                type="button"
                className="lp__google-btn"
                onClick={signInWithGoogle}
                disabled={signingIn}
                aria-label="Sign in with Google"
              >
                {signingIn ? (
                  <span className="lp__btn-spinner" aria-hidden="true" />
                ) : (
                  <GoogleIcon />
                )}
                <span>
                  {signingIn ? 'Signing in…' : 'Continue with Google'}
                </span>
              </button>

              {authError && (
                <div className="lp__error" role="alert">
                  <span>{authError}</span>
                  <button
                    type="button"
                    className="lp__error-close"
                    onClick={clearAuthError}
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}

              <p className="lp__terms">
                By signing in you agree to Google's terms of service. Your tasks
                are stored privately under your Google account.
              </p>
            </div>

            <div className="lp__divider">
              <span>What you get</span>
            </div>

            <ul className="lp__features" aria-label="App features">
              {features.map((f) => (
                <li key={f.title} className="lp__feature">
                  <span className="lp__feature-icon" aria-hidden="true">
                    {f.icon}
                  </span>
                  <div>
                    <div className="lp__feature-title">{f.title}</div>
                    <div className="lp__feature-desc">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          /* ── Supabase not configured → show setup guide ── */
          <>
            <div className="lp__setup-badge">Supabase not configured</div>

            <p className="lp__setup-intro">
              Follow these steps to enable Google sign-in and cloud sync:
            </p>

            <ol className="lp__steps">
              {setupSteps.map((s) => (
                <li key={s.n} className="lp__step">
                  <span className="lp__step-n">{s.n}</span>
                  <span className="lp__step-text">{s.text}</span>
                </li>
              ))}
            </ol>

            <div className="lp__env-block">
              <div className="lp__env-label">.env.local</div>
              <pre className="lp__env-pre">{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}</pre>
            </div>

            <div className="lp__divider">
              <span>Until then</span>
            </div>

            <a href="/" className="lp__anon-btn">
              Continue without sign-in
              <span className="lp__anon-badge">local mode</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
