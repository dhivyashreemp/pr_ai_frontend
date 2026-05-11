// Auth is now handled via HttpOnly cookie — no token in localStorage.
// credentials: "include" instructs the browser to send the cookie automatically.

export function getAuthHeaders(): Record<string, string> {
  return {};
}

/**
 * Drop-in replacement for fetch() that:
 * - Sends the HttpOnly access_token cookie automatically via credentials: "include"
 * - On 401: clears stored user info and redirects to /login
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...options, credentials: "include" });

  if (response.status === 401) {
    localStorage.removeItem("userInfo");
    window.location.href = "/login";
    throw new Error("Unauthorized — session cleared");
  }

  return response;
}
