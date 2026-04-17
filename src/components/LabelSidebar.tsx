import { useEffect, useState } from "react";
import { pdfToImage, isPdfFile } from "@/lib/pdfToImage";

interface LabelSidebarProps {
  baseFile: File | null;
  basePreviewUrl: string | null;
  childFiles: File[];
  childPreviewUrls: string[];
  apiResults: any[];
  selectedIndex: number;
  onSelectChild: (index: number) => void;
  analysisRun: boolean;
}

/**
 * Resolve a thumbnail URL for a file. Prefer the URL the caller passed in
 * (the page upstream already converts PDFs to image data URLs). Fall back
 * to rendering on demand via the shared pdfToImage utility when no URL
 * was supplied but the file is a PDF.
 */
const useThumbnailUrl = (
  file: File | null | undefined,
  fallbackUrl: string | null | undefined
): { url: string | null; error: boolean } => {
  const [state, setState] = useState<{ url: string | null; error: boolean }>({ url: null, error: false });

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
const CardThumbnail = ({ file, url }: { file: File; url: string | null }) => {
  const { url: resolved, error } = useThumbnailUrl(file, url);
  const shell =
    "h-40 w-full bg-white flex items-center justify-center rounded-t-lg overflow-hidden";
  if (error) {
    return <div className={`${shell} text-[10px] uppercase tracking-widest text-gray-400`}>PDF</div>;
  }
  if (!resolved) {
    return <div className={`${shell} text-[10px] uppercase tracking-widest text-gray-300`}>…</div>;
  }
  return (
    <div className={shell}>
      <img src={resolved} alt="" className="max-w-full max-h-full object-contain" />
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
  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">
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
}: {
  filename: string;
  badge: React.ReactNode;
}) => {
  const display = formatDisplayName(filename);
  return (
    <div className="bg-gray-50 px-2 py-1.5 border-t border-gray-100 rounded-b-lg flex items-center justify-between gap-2">
      <div
        className="text-[11px] font-medium text-gray-600 truncate flex-1 min-w-0"
        title={filename}
      >
        {display}
      </div>
      {badge}
    </div>
  );
};

const LabelSidebar = ({
  baseFile,
  basePreviewUrl,
  childFiles,
  childPreviewUrls,
  apiResults,
  selectedIndex,
  onSelectChild,
  analysisRun,
}: LabelSidebarProps) => {
  const childrenList = (
    <div className="flex flex-col gap-3">
      {childFiles.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic py-2 text-center">
          No child labels
        </div>
      ) : (
        childFiles.map((file, idx) => {
          const analysed = analysisRun && !!apiResults[idx];
          const isActive = idx === selectedIndex;
          return (
            <button
              key={`${file.name}-${idx}`}
              type="button"
              onClick={() => onSelectChild(idx)}
              className={`w-full text-left bg-white rounded-lg overflow-hidden transition-all duration-150 transform-gpu ${
                isActive
                  ? "border-2 border-[#d51900] shadow-md"
                  : "border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02]"
              }`}
            >
              <CardThumbnail file={file} url={childPreviewUrls[idx] ?? null} />
              <CardFooter
                filename={file.name}
                badge={<StatusBadge analysed={analysed} />}
              />
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <aside
      className="w-[280px] shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto"
      style={{ height: "100%" }}
    >
      {/* ── Section header ──────────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Labels
        </div>
      </div>

      <div className="p-3 pt-0">
        {baseFile ? (
          <>
            {/* ── Base card — non-clickable ─────────────── */}
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <CardThumbnail file={baseFile} url={basePreviewUrl} />
              <CardFooter filename={baseFile.name} badge={<BaseBadge />} />
            </div>

            {/* ── Child label section header ────────────── */}
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1">
              Child Labels
            </div>

            {/* ── Indented child list with left rail ────── */}
            <div className="pl-3 border-l border-gray-300 ml-1">
              {childrenList}
            </div>
          </>
        ) : (
          // No base — render children flat without the rail
          <>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Child Labels
            </div>
            {childrenList}
          </>
        )}
      </div>
    </aside>
  );
};

export default LabelSidebar;
