import { useState } from 'react';
import { useTheme } from './ThemeContext';
// import { ThemeSwitcher } from './ThemeSwitcher';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { ArrowLeft, Home, ScanLine } from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';

interface ReportHeaderProps {
  activeScenario: 'A' | 'B' | 'C';
  onScenarioChange: (scenario: 'A' | 'B' | 'C') => void;
  reportId?: string;
  currentRevision?: string;
  newRevision?: string;
  onDownloadPDF?: () => void;
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="square" strokeLinejoin="miter" d="M12 3v13M7 11l5 5 5-5M3 21h18" />
    </svg>
  );
}

function getISTDateParts() {
  const now = new Date();
  const ist  = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const yyyy = ist.getUTCFullYear();
  const mm   = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(ist.getUTCDate()).padStart(2, '0');
  const hh   = String(ist.getUTCHours()).padStart(2, '0');
  const min  = String(ist.getUTCMinutes()).padStart(2, '0');
  return { yyyy, mm, dd, hh, min };
}

function generateReportId(): string {
  const { yyyy, mm, dd } = getISTDateParts();
  const dateKey    = `${yyyy}${mm}${dd}`;
  const storageKey = `lpr_counter_${dateKey}`;
  const last = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
  const next = last + 1;
  localStorage.setItem(storageKey, String(next));
  return `${dateKey}${String(next).padStart(4, '0')}`;
}

export function ReportHeader({
  activeScenario,
  onScenarioChange,
  reportId: propReportId,
  currentRevision,
  newRevision,
  onDownloadPDF,
}: ReportHeaderProps) {
  const { theme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useUser();
  // Use the ID generated at analysis time; fall back to generating one if accessed directly
  const [reportId] = useState<string>(() => propReportId || generateReportId());

  const revisionLabel = currentRevision && newRevision
    ? `${currentRevision} \u2192 ${newRevision}`
    : currentRevision || newRevision || '';

  const handleBack = () => {
    const s: any = location.state ?? {};
    // Reconstruct the expanded-preview-URL array from whatever ReportPage
    // received. ReportPage may have only the single selected childPreviewUrl
    // (string), so fall back to a 1-element array if the full list isn't
    // present.
    const expandedChildPreviewUrls: string[] =
      s.expandedChildPreviewUrls ??
      (s.childPreviewUrl ? [s.childPreviewUrl] : []);
    navigate('/preview', {
      state: {
        // Spread first so any state that flowed through the
        // /compare → /preview → /report chain is preserved, then override the
        // specific keys we care about below.
        ...s,
        formData:     s.formData,
        submissionId: s.submissionId,
        scenario:     s.scenario,
        baseFile:     s.baseFile  ? [s.baseFile]  : (s.baseFile  ?? []),
        childFile:    s.childFile ? [s.childFile] : (s.childFile ?? []),
        // Full expanded child array + preview URLs + UI state needed to restore
        // the /compare sidebar and main viewer when the user hits Back again.
        childFiles:               s.childFiles               ?? [],
        basePreviewUrl:           s.basePreviewUrl           ?? '',
        expandedChildPreviewUrls,
        analysisRun:              s.analysisRun              ?? true,
        selectedResultIndex:      s.selectedResultIndex      ?? 0,
        apiResults:   s.apiResults   ?? [],
        lrfAnalysis:  s.lrfAnalysis  ?? null,
        parsedItems:  s.parsedItems  ?? [],
        missingItems: s.missingItems ?? [],
        satisfiedItems:   s.satisfiedItems   ?? [],
        userAnnotations:  s.userAnnotations  ?? [],
        discardedUnexpectedIds: [...(s.discardedUnexpectedIds ?? [])],
        annotations:      s.annotations      ?? [],
        requirementBoxes: s.requirementBoxes ?? [],
        barcode_summary:  s.barcode_summary  ?? null,
        baseFileName:     s.baseFileName     ?? '',
        childFileName:    s.childFileName    ?? '',
      },
    });
  };

  const handleDownloadPDF = () => {
    const { yyyy, mm, dd, hh, min } = getISTDateParts();
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min} IST`;
    const style = document.createElement('style');
    style.id = '__print-override__';
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 14mm 12mm 18mm 12mm;
        @bottom-left   { content: "LPR: ${reportId}"; font-size: 7pt; color: #888; font-family: sans-serif; }
        @bottom-center { content: "Page " counter(page); font-size: 7pt; color: #888; font-family: sans-serif; }
        @bottom-right  { content: "${dateStr} ${timeStr}"; font-size: 7pt; color: #888; font-family: sans-serif; }
      }
      @media print {
        html, body, .h-screen, .flex, .flex-1, .overflow-hidden, .overflow-y-auto {
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        body { margin: 0; background: #fff !important; }

        .report-content-wrap { max-width: none !important; padding: 0 !important; margin: 0 auto !important; overflow: visible !important; }

        .report-banner {
          padding: 22px 28px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .report-banner-title {
          font-size: 24pt !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
        }
        .report-banner-id {
          font-size: 8.5pt !important;
          margin-top: 4px !important;
        }
        .report-banner-logo {
          height: 32px !important;
          width: auto !important;
        }
        .report-banner-revision {
          font-size: 10pt !important;
          font-weight: 600 !important;
          margin-top: 4px !important;
        }

        .report-metadata-bar { font-size: 8.5pt !important; }

        .report-page-break { page-break-before: always !important; break-before: page !important; display: block !important; }
        .report-page-break:last-of-type { page-break-after: auto !important; break-after: auto !important; }

        .report-label-page {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .report-label-img {
          max-height: 180mm !important;
          width: auto !important;
          max-width: 100% !important;
          display: block !important;
          margin: 0 auto !important;
        }

        .report-section { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 0 !important; }
        .report-section:last-of-type { page-break-after: auto !important; }
        .report-section-header { page-break-after: avoid; }

        table { width: 100% !important; font-size: 8pt !important; }
        th, td { padding: 4px 6px !important; }

        span[class*="inline-block"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);
    const prevTitle = document.title;
    document.title = reportId;
    window.scrollTo(0, 0);
    document.title = prevTitle;
    document.head.removeChild(style);
  };

  return (
    <header
      className="report-banner w-full"
      style={{ backgroundColor: theme.primary, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
    >
      {/* ── On-screen nav bar (hidden when printing) ── */}
      <div
        className="print:hidden border-b px-6 flex items-center justify-between"
        style={{ minHeight: 52, borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <div className="flex items-center gap-4 h-[52px]">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 border-r pr-4 h-full text-white/80 hover:text-white transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2 text-white">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelIX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">Report</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-white/60 text-[11px] mr-2 hidden lg:block">
            Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 border border-white/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/10 transition-colors"
          >
            <Home className="h-3 w-3" />
            Home
          </button>
          <button
            onClick={onDownloadPDF ?? handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border border-transparent"
            style={{ backgroundColor: theme.accent, color: '#fff' }}
            title="Download as PDF"
          >
            <DownloadIcon />
            PDF
          </button>
          {/* <ThemeSwitcher /> */}
          <ProfileDropdown />
        </div>
      </div>

      {/* ── Printable banner (full-width: title left, logo right) ── */}
      <div className="w-full px-8 py-6 flex items-start justify-between">
        {/* Left corner: title + report ID */}
        <div className="space-y-1">
          <h1 className="report-banner-title text-white text-2xl font-bold tracking-tight">
            Label Proofing Report
          </h1>
          <div className="report-banner-id text-white/80 text-xs">Report ID: {reportId}</div>
          {revisionLabel && (
            <div className="report-banner-revision text-white/90 text-sm font-semibold tracking-wide mt-1">
              {revisionLabel}
            </div>
          )}
        </div>

        {/* Right corner: logo */}
        <div className="flex flex-col items-end justify-center self-center">
          <img src="/novintix-logo.png" alt="Novintix" className="report-banner-logo h-8 w-auto" />
        </div>
      </div>
    </header>
  );
}
