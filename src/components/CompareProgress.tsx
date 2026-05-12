import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import type { CompareStreamState, LogEntry } from "@/hooks/useCompareStream";

interface CompareProgressProps {
  state: CompareStreamState;
  onDone: (results: any[], reportId: string | null) => void;
  onCancel?: () => void;
}

export function CompareProgress({ state, onDone, onCancel }: CompareProgressProps) {
  const { status, total, completed, base, revised, source, etaSecs, log, reportId, results, totalSecs, error } = state;
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "done") onDone(results, reportId);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  if (status === "idle") return null;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const sourceLabel = source === "pdf"
    ? (base && revised ? `${base} vs ${revised}` : null)
    : total > 0 ? `${total} files` : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-2xl mx-auto flex flex-col gap-4">

      {/* ── Header ── */}
      {status === "error" ? (
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600">Analysis failed</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
              Dismiss
            </button>
          )}
        </div>
      ) : status === "partial_failed" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700">
                {log.filter(e => e.status === "error").length} label{log.filter(e => e.status === "error").length !== 1 ? "s" : ""} failed — report will be incomplete
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {results.length} of {total} completed in {formatTime(totalSecs)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => onDone(results, reportId)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded px-3 py-1.5 transition-colors"
            >
              Proceed with partial results
            </button>
          </div>
        </div>
      ) : status === "done" ? (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-700">
              {total} label{total !== 1 ? "s" : ""} analysed in {formatTime(totalSecs)}
            </p>
            {sourceLabel && <p className="text-xs text-gray-400 mt-0.5 truncate">{sourceLabel}</p>}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              <span className="text-blue-600">{completed}</span>
              <span className="text-gray-400"> / </span>
              <span>{total || "…"}</span>
              <span className="text-gray-500 font-normal"> labels done</span>
              {etaSecs != null && etaSecs > 0 && (
                <span className="text-gray-400 font-normal text-xs ml-2">
                  · {completed === 0 ? "est. " : "~"}{formatTime(etaSecs)} remaining
                </span>
              )}
            </p>
            {sourceLabel && <p className="text-xs text-gray-400 mt-0.5 truncate">{sourceLabel}</p>}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {total > 0 && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              status === "done" ? "bg-green-500" : status === "partial_failed" ? "bg-amber-400" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* ── Per-label log ── */}
      {log.length > 0 && (
        <div className="border-t border-gray-100 pt-3 max-h-72 overflow-y-auto flex flex-col gap-0.5">
          {[...log].sort((a, b) => a.page - b.page).map(entry => (
            <LogRow key={entry.page} entry={entry} />
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded text-[13px]">
      <StatusIcon status={entry.status} />
      <span className="flex-1 min-w-0 truncate text-gray-700">{entry.label}</span>
      {entry.status === "done" && (
        <span className="shrink-0 text-gray-400 tabular-nums">{entry.tookSecs}s</span>
      )}
      {entry.status === "error" && (
        <span className="shrink-0 text-red-400 text-xs truncate max-w-[160px]" title={entry.error ?? ""}>{entry.error}</span>
      )}
      {entry.status === "running" && (
        <span className="shrink-0 text-blue-400 text-xs">running…</span>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: LogEntry["status"] }) {
  if (status === "done")    return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  if (status === "error")   return <XCircle      className="w-3.5 h-3.5 text-red-500   shrink-0" />;
  return <Loader2 className="w-3.5 h-3.5 text-blue-500 shrink-0 animate-spin" />;
}

function formatTime(secs: number | null): string {
  if (secs == null || secs <= 0) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
