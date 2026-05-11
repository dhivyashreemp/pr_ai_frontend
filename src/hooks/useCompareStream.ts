import { useState, useCallback, useRef } from "react";
import { authFetch } from "@/lib/authFetch";

export type StreamStatus = "idle" | "running" | "done" | "error";

export interface LogEntry {
  page: number;
  label: string;
  status: "running" | "done" | "error";
  tookSecs: number | null;
  error: string | null;
}

export interface CompareStreamState {
  status: StreamStatus;
  total: number;
  completed: number;
  source: string | null;
  base: string | null;
  revised: string | null;
  etaSecs: number | null;
  log: LogEntry[];
  results: any[];
  reportId: string | null;
  totalSecs: number | null;
  error: string | null;
}

const INITIAL_STATE: CompareStreamState = {
  status:    "idle",
  total:     0,
  completed: 0,
  source:    null,
  base:      null,
  revised:   null,
  etaSecs:   null,
  log:       [],
  results:   [],
  reportId:  null,
  totalSecs: null,
  error:     null,
};

function applyEvent(state: CompareStreamState, event: any): CompareStreamState {
  switch (event.type) {
    case "init":
      return { ...state, total: event.total, source: event.source, base: event.base, revised: event.revised, etaSecs: event.eta_secs };
    case "pair_start":
      return { ...state, log: [...state.log, { page: event.page, label: event.label, status: "running", tookSecs: null, error: null }] };
    case "pair_done":
      return {
        ...state,
        completed: event.completed,
        etaSecs:   event.eta_secs,
        log: state.log.map(e => e.page === event.page ? { ...e, status: "done", tookSecs: event.took_secs } : e),
      };
    case "pair_error":
      return {
        ...state,
        completed: state.completed + 1,
        log: state.log.map(e => e.page === event.page ? { ...e, status: "error", error: event.error } : e),
      };
    case "complete":
      return { ...state, status: "done", results: event.results, reportId: event.report_id, totalSecs: event.total_secs, etaSecs: 0 };
    default:
      return state;
  }
}

export function useCompareStream({ apiBase = "" }: { apiBase?: string } = {}) {
  const [state, setState] = useState<CompareStreamState>(INITIAL_STATE);
  const abortRef     = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  const start = useCallback(async (formData: FormData) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL_STATE, status: "running" });

    try {
      const response = await authFetch(`${apiBase}/api/compare/stream`, {
        method: "POST",
        body:   formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        setState(s => ({ ...s, status: "error", error: text }));
        return;
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let event: any;
          try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
          setState(s => applyEvent(s, event));
          if (event.type === "complete") {
            reader.cancel();
            return;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setState(s => ({ ...s, status: "error", error: err.message }));
    } finally {
      isRunningRef.current = false;
    }
  }, [apiBase]);

  const cancel = useCallback(() => {
    isRunningRef.current = false;
    if (abortRef.current) abortRef.current.abort();
    setState(s => ({ ...s, status: "idle" }));
  }, []);

  const reset = useCallback(() => {
    isRunningRef.current = false;
    if (abortRef.current) abortRef.current.abort();
    setState(INITIAL_STATE);
  }, []);

  return { start, cancel, reset, state };
}
