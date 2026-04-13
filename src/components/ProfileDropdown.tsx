import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useUser } from "@/context/UserContext";

/**
 * Reusable profile avatar + dropdown used in every page navbar.
 * Click the avatar to open; click Logout to clear session and show the login modal.
 */
const ProfileDropdown = () => {
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user.name) return null;

  return (
    <div ref={ref} className="relative pl-4 border-l border-white/20">
      {/* Avatar pill — click to toggle dropdown */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10 transition-colors focus:outline-none"
      >
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold uppercase">
          {user.name.charAt(0)}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold leading-tight text-white">{user.name}</div>
          {user.role && (
            <div className="text-[10px] text-white/60 leading-tight">{user.role}</div>
          )}
        </div>
        <ChevronDown size={12} color="rgba(255,255,255,0.6)" className="ml-0.5" />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 shadow-xl rounded z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
            {user.role && (
              <p className="text-[10px] text-gray-400 truncate mt-0.5">{user.role}</p>
            )}
          </div>
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
