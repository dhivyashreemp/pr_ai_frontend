import { useState, useRef, useEffect } from 'react';
import { useTheme, ThemeName } from './ThemeContext';

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const themes: Array<{ name: ThemeName; label: string; colors: string[] }> = [
    { name: 'default', label: 'Default', colors: ['#064b75', '#f4a303'] },
    { name: 'slate',   label: 'Slate',   colors: ['#334155', '#3b82f6'] },
    { name: 'warm',    label: 'Warm',    colors: ['#78350f', '#f97316'] },
  ];

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 border-2 border-white text-white hover:bg-white/10 transition-colors flex items-center justify-center"
        aria-label="Change theme"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-12 right-0 bg-white border border-gray-300 shadow-lg z-50 w-48">
          <div className="p-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 px-2 py-1">Select Theme</div>
            {themes.map((t) => (
              <button
                key={t.name}
                onClick={() => { setTheme(t.name); setIsOpen(false); }}
                className={`w-full px-2 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center justify-between ${theme.name === t.name ? 'bg-gray-50' : ''}`}
              >
                <span className="text-gray-700">{t.label}</span>
                <div className="flex gap-1">
                  {t.colors.map((color, i) => (
                    <div key={i} className="w-4 h-4 border border-gray-300" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
