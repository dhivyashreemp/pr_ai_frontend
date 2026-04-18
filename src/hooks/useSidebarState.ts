import { useCallback, useEffect, useRef, useState } from "react";

export const MIN_WIDTH = 180;
export const MAX_WIDTH = 400;
export const COLLAPSED_WIDTH = 48;

const DEBOUNCE_MS = 300;

interface SidebarState {
  isCollapsed: boolean;
  width: number;
}

const DEFAULT_STATE: SidebarState = { isCollapsed: false, width: 280 };

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
}

function readFromStorage(key: string): SidebarState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      isCollapsed: !!parsed.isCollapsed,
      width: clampWidth(typeof parsed.width === "number" ? parsed.width : DEFAULT_STATE.width),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useSidebarState(key: string = "labelx-sidebar") {
  const [state, setState] = useState<SidebarState>(() => readFromStorage(key));
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
      const clamped = clampWidth(w);
      setState((prev) => {
        const next = { ...prev, width: clamped };
        persist(next);
        return next;
      });
    },
    [persist],
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
