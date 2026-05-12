import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { API_URL } from '@/constants';
import { setSessionToken } from '@/lib/authFetch';

const MicrosoftLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="w-5 h-5 mr-3">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#ffb900" />
    <rect x="11" y="11" width="9" height="9" fill="#00a4ef" />
  </svg>
);

/** Read claims from a JWT without verifying the signature (display-only). */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

const LoginPage = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      // Clean URL immediately — token must not sit in browser history / referrer.
      window.history.replaceState({}, "", "/login");

      // Persist for authFetch to attach as Bearer on every subsequent API call.
      setSessionToken(urlToken);

      // Decode name + role from JWT payload (no signature verification needed —
      // only used for UI display; all real authorization happens on the backend).
      const claims = decodeJwt(urlToken);
      const name = claims?.name ?? claims?.preferred_username ?? "";
      const role = claims?.role ?? claims?.roles?.[0] ?? "";

      if (name) {
        setUser({ name, role });
        navigate('/');
        return;
      }
    }

    // Fallback: cookie-based auth for when the backend adds HttpOnly cookie support.
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.name) {
          setUser({ name: data.name, role: data.role || "" });
          navigate('/');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = `${API_URL}/auth/login`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-10 flex flex-col items-center">

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img src="/favicon.ico" alt="Logo" className="w-12 h-12" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-sm text-gray-500 mb-10 text-center">
          Sign in to access your account
        </p>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-lg shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f59e0b] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-[#f59e0b] rounded-full animate-spin"></div>
              <span>Signing in...</span>
            </div>
          ) : (
            <>
              <MicrosoftLogo />
              Sign in with Microsoft
            </>
          )}
        </button>

        <div className="mt-10 pt-6 border-t border-gray-100 w-full text-center">
          <p className="text-xs text-gray-400">
            Need help? Contact your account manager
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
