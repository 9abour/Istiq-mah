/**
 * Server-only API route: POST /api/google/token
 *
 * Accepts:  { refreshToken: string }
 * Returns:  { accessToken: string }
 *
 * Replicates `google.auth.OAuth2.refreshAccessToken()` via a direct POST to
 * Google's token endpoint. The client_secret stays on the server — it is
 * read from process.env and never sent to the browser.
 */
import type { ActionFunctionArgs } from 'react-router';

/** Shape returned by Google's token endpoint */
type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let refreshToken: string | undefined;
  try {
    const body = (await request.json()) as { refreshToken?: string };
    refreshToken = body?.refreshToken;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!refreshToken) {
    return Response.json({ error: 'refreshToken is required' }, { status: 400 });
  }

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.VITE_GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Google OAuth credentials not configured on server' },
      { status: 500 }
    );
  }

  try {
    // Equivalent to: oAuth2Client.setCredentials({ refresh_token })
    //                oAuth2Client.refreshAccessToken()
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await googleRes.json()) as GoogleTokenResponse;

    if (!googleRes.ok || !data.access_token) {
      const msg = data.error_description ?? data.error ?? 'Failed to get access token';
      return Response.json({ error: msg }, { status: 502 });
    }

    return Response.json({ accessToken: data.access_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get access token';
    return Response.json({ error: message }, { status: 502 });
  }
}
