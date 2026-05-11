function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Drop-in replacement for fetch() that:
 * - Attaches Authorization: Bearer <token> from localStorage
 * - On 401: clears the stored token and redirects to /login
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized — session cleared");
  }

  return response;
}
