import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { API_URL } from '@/constants';

const MicrosoftLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="w-5 h-5 mr-3">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);


const LoginPage = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ name: payload.name, role: payload.role });
      navigate('/');
    }
  }, []);

  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = `${API_URL}/auth/login`;
    console.log(API_URL);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-10 flex flex-col items-center">

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img src="/favicon.ico" alt="Logo" className="w-12 h-12" />
        </div>

        {/* Header Texts */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-sm text-gray-500 mb-10 text-center">
          Sign in to access your account
        </p>

        {/* Action Button */}
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

        {/* Footer */}
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
