// Auth strategy (in priority order):
//  1. HttpOnly cookie — set by backend after OAuth, sent automatically via credentials:"include"
//  2. Bearer token   — fallback when backend still redirects with ?token= in the URL.
//     Stored in sessionStorage (cleared on tab close, never in localStorage).
//
// Both strategies are attempted simultaneously so the transition period where the
// backend sends both a cookie AND a query-string token works without any change here.

const SESSION_TOKEN_KEY = "access_token";

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

/**
 * Drop-in replacement for fetch() that:
 * - Sends the HttpOnly access_token cookie automatically via credentials: "include"
 * - Attaches Authorization: Bearer <token> when a token is present in sessionStorage
 * - On 401: clears all auth state and redirects to /login
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, credentials: "include", headers });

  if (response.status === 401) {
    clearSessionToken();
    localStorage.removeItem("userInfo");
    window.location.href = "/login";
    throw new Error("Unauthorized — session cleared");
  }

  return response;
}
