import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pdfToImage, isPdfFile } from "@/lib/pdfToImage";
import { useSidebarState, MIN_WIDTH, MAX_WIDTH, COLLAPSED_WIDTH } from "@/hooks/useSidebarState";

interface LabelSidebarProps {
  baseFile: File | null;
  basePreviewUrl: string | null;
  baseFileName?: string;
  childFiles: File[];
  childPreviewUrls: string[];
  apiResults: any[];
  selectedIndex: number;
  onSelectChild: (index: number) => void;
  analysisRun: boolean;
  forceClosedOnMount?: boolean;
}

/**
 * Resolve a thumbnail URL for a file. Prefer the URL the caller passed in
 * (the page upstream already converts PDFs to image data URLs). Fall back
 * to rendering on demand via the shared pdfToImage utility when no URL
 * was supplied but the file is a PDF.
 */
const useThumbnailUrl = (
  file: File | null | undefined,
  fallbackUrl: string | null | undefined,
): { url: string | null; error: boolean } => {
  const [state, setState] = useState<{ url: string | null; error: boolean }>({
    url: null,
    error: false,
  });

  useEffect(() => {
    // All preview URLs passed by parent pages are data URLs (never revocable).
    // Use directly — no file processing needed.
    if (fallbackUrl) {
      setState({ url: fallbackUrl, error: false });
      return;
    }

    // No pre-rendered URL — generate from the File object on demand.
    if (!file) {
      setState({ url: null, error: false });
      return;
    }

    if (!isPdfFile(file)) {
      const blobUrl = URL.createObjectURL(file);
      setState({ url: blobUrl, error: false });
      return () => URL.revokeObjectURL(blobUrl);
    }

    // PDF without a pre-rendered URL — render on demand.
    let cancelled = false;
    setState({ url: null, error: false });
    pdfToImage(file)
      .then((dataUrl) => {
        if (!cancelled) setState({ url: dataUrl, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [file, fallbackUrl]);

  return state;
};

/** Portrait thumbnail panel used at the top of each card. */
const CardThumbnail = ({ file, url }: { file: File | null; url: string | null }) => {
  const { url: resolved, error } = useThumbnailUrl(file, url);
  const shell =
    "h-40 w-full bg-white flex items-center justify-center overflow-hidden";
  if (error) {
    return (
      <div className={`${shell} text-[10px] uppercase tracking-widest text-gray-400`}>PDF</div>
    );
  }
  if (!resolved) {
    return (
      <div className={`${shell} text-[10px] uppercase tracking-widest text-gray-300`}>…</div>
    );
  }
  return (
    <div className={shell}>
      <img src={resolved} alt="" className="max-w-full max-h-full object-contain" />
    </div>
  );
};

/** Small square thumbnail for collapsed filmstrip mode. */
const FilmstripThumb = ({ file, url }: { file: File; url: string | null }) => {
  const { url: resolved } = useThumbnailUrl(file, url);
  return (
    <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-gray-100 shrink-0">
      {resolved ? (
        <img src={resolved} alt="" className="w-full h-full object-contain" />
      ) : (
        <span className="text-[8px] text-gray-400">…</span>
      )}
    </div>
  );
};

const StatusBadge = ({ analysed }: { analysed: boolean }) => (
  <span
    className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
      analysed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
    }`}
  >
    {analysed ? "Analysed" : "Pending"}
  </span>
);

const BaseBadge = () => (
  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
    Base
  </span>
);

/**
 * Reformat per-page PDF page filenames for display.
 *   "Child_v1_page2.png" → "Child_v1 — Page 2"
 * Other filenames pass through unchanged.
 */
const formatDisplayName = (filename: string): string => {
  const match = filename.match(/^(.+)_page(\d+)\.[^.]+$/);
  if (!match) return filename;
  return `${match[1]} — Page ${match[2]}`;
};

const CardFooter = ({
  filename,
  badge,
  dotColor,
}: {
  filename: string;
  badge: React.ReactNode;
  dotColor?: string;
}) => {
  const display = formatDisplayName(filename);
  return (
    <div className="bg-gray-50 px-2 py-1.5 border-t border-gray-100 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {dotColor && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />}
        <div className="text-[11px] font-medium text-gray-600 truncate min-w-0" title={filename}>
          {display}
        </div>
      </div>
      {badge}
    </div>
  );
};

const LabelSidebar = ({
  baseFile,
  basePreviewUrl,
  baseFileName,
  childFiles,
  childPreviewUrls,
  apiResults,
  selectedIndex,
  onSelectChild,
  analysisRun,
  forceClosedOnMount,
}: LabelSidebarProps) => {
  const { isCollapsed, width, toggleCollapse, setWidth } = useSidebarState("labelix-sidebar", { forceClosedOnMount });
  const sidebarRef = useRef<HTMLElement>(null);
  const dragWidthRef = useRef<number>(width);

  const displayWidth = isCollapsed ? COLLAPSED_WIDTH : width;

  // ── Resize drag logic ────────────────────────────────────────────────────────
  // Direct DOM manipulation during drag — zero React re-renders mid-drag.
  // One setState (via setWidth) fires only on mouseup.
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!sidebarRef.current) return;

      // Initialise from the current rendered width so drag starts from actual position.
      dragWidthRef.current = sidebarRef.current.getBoundingClientRect().width;
      // Disable CSS transition while dragging for instant feedback.
      sidebarRef.current.style.transition = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!sidebarRef.current) return;
        const rect = sidebarRef.current.getBoundingClientRect();
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, ev.clientX - rect.left));
        dragWidthRef.current = newWidth;
        sidebarRef.current.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        if (sidebarRef.current) sidebarRef.current.style.transition = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        // One React state update + localStorage persist at drag end.
        setWidth(dragWidthRef.current);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [setWidth],
  );

  // ── Child card list (expanded mode) ─────────────────────────────────────────
  const childrenList = (
    <div className="flex flex-col gap-3">
      {childFiles.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic py-2 text-center">No child labels</div>
      ) : (
        childFiles.map((file, idx) => {
          const analysed = analysisRun && !!apiResults[idx];
          const isActive = idx === selectedIndex;
          return (
            <button
              key={`${file.name}-${idx}`}
              type="button"
              onClick={() => onSelectChild(idx)}
              className={`w-full text-left rounded-lg overflow-hidden transition-all duration-150 transform-gpu ${
                isActive
                  ? "border border-red-200 border-l-4 border-l-[#d51900] bg-red-50 shadow-md"
                  : "border border-gray-200 border-l-4 border-l-gray-300 bg-white shadow-sm hover:shadow-md hover:scale-[1.02]"
              }`}
            >
              <CardThumbnail file={file} url={childPreviewUrls[idx] ?? null} />
              <CardFooter
                filename={file.name}
                badge={<StatusBadge analysed={analysed} />}
                dotColor={isActive ? "bg-[#d51900]" : "bg-gray-300"}
              />
            </button>
          );
        })
      )}
    </div>
  );

  // ── Expanded sidebar content ─────────────────────────────────────────────────
  const expandedContent = (
    <>
      <div className="px-3 pt-3 pb-2">
        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">Labels</span>
      </div>
      <div className="p-3 pt-0">
        {(baseFile || basePreviewUrl) ? (
          <>
            <div className="bg-blue-50 rounded-lg overflow-hidden border border-blue-200 border-l-4 border-l-blue-500 shadow-sm">
              <CardThumbnail file={baseFile} url={basePreviewUrl} />
              <CardFooter
                filename={baseFile?.name ?? baseFileName ?? ''}
                badge={<BaseBadge />}
                dotColor="bg-blue-500"
              />
            </div>
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-3 mb-2">Child Labels</span>
            <div className="pl-3 border-l border-gray-300 ml-1">{childrenList}</div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">Child Labels</span>
            {childrenList}
          </>
        )}
      </div>
    </>
  );

  // ── Collapsed filmstrip content ──────────────────────────────────────────────
  const collapsedContent = (
    <div className="flex flex-col items-center gap-2 pt-3 pb-3 px-1">
      {baseFile && (
        <div title={baseFile.name} className="rounded-md ring-2 ring-blue-400 cursor-default">
          <FilmstripThumb file={baseFile} url={basePreviewUrl} />
        </div>
      )}
      {baseFile && childFiles.length > 0 && (
        <div className="w-5 h-px bg-gray-200" />
      )}
      {childFiles.map((file, idx) => {
        const isActive = idx === selectedIndex;
        return (
          <button
            key={`${file.name}-${idx}`}
            type="button"
            title={file.name}
            onClick={() => onSelectChild(idx)}
            className={`rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d51900] ${
              isActive ? "ring-2 ring-[#d51900]" : "ring-1 ring-gray-200"
            }`}
          >
            <FilmstripThumb file={file} url={childPreviewUrls[idx] ?? null} />
          </button>
        );
      })}
    </div>
  );

  return (
    <aside
      ref={sidebarRef as React.RefObject<HTMLElement>}
      className="relative shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col transition-[width] duration-200 ease-in-out"
      style={{ width: displayWidth, height: "100%" }}
    >
      {/* ── Scrollable content area ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isCollapsed ? collapsedContent : expandedContent}
      </div>

      {/* ── Resize handle — right edge, expanded only ────────────────────── */}
      {!isCollapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400/50 active:bg-blue-500/60"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* ── Collapse / expand toggle button ──────────────────────────────── */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 rounded-full w-5 h-5 bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight size={12} className="shrink-0" />
        ) : (
          <ChevronLeft size={12} className="shrink-0" />
        )}
      </button>
    </aside>
  );
};

export default LabelSidebar;
