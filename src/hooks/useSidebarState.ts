import { useCallback, useEffect, useRef, useState } from "react";

// ── Left sidebar constants ────────────────────────────────────────────────────
export const MIN_WIDTH      = 180;
export const MAX_WIDTH      = 400;
export const COLLAPSED_WIDTH = 48;

// ── Right review panel constants ──────────────────────────────────────────────
export const PANEL_MIN_WIDTH       = 240;
export const PANEL_MAX_WIDTH       = 500;
export const PANEL_COLLAPSED_WIDTH = 48;

const DEBOUNCE_MS = 300;

interface SidebarState {
  isCollapsed: boolean;
  width: number;
}

interface SidebarOptions {
  min?: number;
  max?: number;
  defaultWidth?: number;
}

const FALLBACK_DEFAULT: SidebarState = { isCollapsed: false, width: 280 };

export function useSidebarState(key: string = "labelx-sidebar", options?: SidebarOptions) {
  const min          = options?.min          ?? MIN_WIDTH;
  const max          = options?.max          ?? MAX_WIDTH;
  const defaultWidth = options?.defaultWidth ?? FALLBACK_DEFAULT.width;

  const clamp = useCallback(
    (w: number) => Math.max(min, Math.min(max, w)),
    [min, max],
  );

  const [state, setState] = useState<SidebarState>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { isCollapsed: false, width: defaultWidth };
      const parsed = JSON.parse(raw);
      return {
        isCollapsed: !!parsed.isCollapsed,
        width: Math.max(min, Math.min(max,
          typeof parsed.width === "number" ? parsed.width : defaultWidth,
        )),
      };
    } catch {
      return { isCollapsed: false, width: defaultWidth };
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: SidebarState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage unavailable — silently ignore
        }
      }, DEBOUNCE_MS);
    },
    [key],
  );

  const toggleCollapse = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, isCollapsed: !prev.isCollapsed };
      persist(next);
      return next;
    });
  }, [persist]);

  const setWidth = useCallback(
    (w: number) => {
      const clamped = clamp(w);
      setState((prev) => {
        const next = { ...prev, width: clamped };
        persist(next);
        return next;
      });
    },
    [clamp, persist],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    isCollapsed: state.isCollapsed,
    width: state.width,
    toggleCollapse,
    setWidth,
  };
}
