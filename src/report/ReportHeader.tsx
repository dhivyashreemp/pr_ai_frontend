import { useTheme } from './ThemeContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { ArrowLeft, Home } from 'lucide-react';
import ProfileDropdown from '@/components/ProfileDropdown';

interface ReportHeaderProps {
  activeScenario: 'A' | 'B' | 'C';
  onScenarioChange: (scenario: 'A' | 'B' | 'C') => void;
  reportId?: string;
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
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const yyyy = ist.getUTCFullYear();
  const mm   = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(ist.getUTCDate()).padStart(2, '0');
  const hh   = String(ist.getUTCHours()).padStart(2, '0');
  const min  = String(ist.getUTCMinutes()).padStart(2, '0');
  return { yyyy, mm, dd, hh, min };
}

export function ReportHeader({ activeScenario, onScenarioChange, reportId: propReportId }: ReportHeaderProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { yyyy, mm, dd } = getISTDateParts();
  const reportId = propReportId ?? `${yyyy}${mm}${dd}0001`;

  const handleBack = () => {
    const s = location.state;
    // Navigate back to /compare with all state restored so the page doesn't re-run analysis
    navigate('/compare', {
      state: {
        formData:     s?.formData,
        submissionId: s?.submissionId,
        // Index.tsx expects File[] for both; report stores single File or null
        baseFile:     s?.baseFile  ? [s.baseFile]  : [],
        childFile:    s?.childFile ? [s.childFile] : [],
        apiResults:   s?.apiResults  ?? [],
        lrfAnalysis:  s?.lrfAnalysis ?? null,
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
        @top-left   { content: "LPR: ${reportId}"; font-size: 7pt; color: #888; font-family: sans-serif; }
        @top-center { content: "Page " counter(page); font-size: 7pt; color: #888; font-family: sans-serif; }
        @top-right  { content: "${dateStr} ${timeStr}"; font-size: 7pt; color: #888; font-family: sans-serif; }
        @bottom-left   { content: "LPR: ${reportId}"; font-size: 7pt; color: #888; font-family: sans-serif; }
        @bottom-center { content: "Page " counter(page); font-size: 7pt; color: #888; font-family: sans-serif; }
        @bottom-right  { content: "${dateStr} ${timeStr}"; font-size: 7pt; color: #888; font-family: sans-serif; }
      }
      @media print {
        body { margin: 0; background: #fff !important; }

        /* Remove max-width constraint so content fills the A4 page */
        .report-content-wrap { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }

        /* Banner: force background colour + bigger title */
        .report-banner {
          padding: 28px 32px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .report-banner-title {
          font-size: 26pt !important;
          font-weight: 700 !important;
          line-height: 1.25 !important;
          letter-spacing: -0.01em !important;
        }
        .report-banner-id {
          font-size: 9pt !important;
          margin-top: 6px !important;
        }
        .report-banner-logo {
          height: 36px !important;
          width: auto !important;
        }

        /* Metadata bar */
        .report-metadata-bar {
          font-size: 9pt !important;
        }

        /* Hard page breaks between major sections */
        .report-page-break { page-break-before: always !important; break-before: page !important; }

        /* Keep label header + image together on one page.
           Use absolute mm so the cap is reliable regardless of viewport. */
        .report-label-page {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .report-label-img {
          max-height: 200mm !important;
          width: auto !important;
          max-width: 100% !important;
          display: block !important;
          margin: 0 auto !important;
        }

        /* Keep sections together where possible */
        .report-section { page-break-inside: avoid; }
        .report-section-header { page-break-after: avoid; }

        /* Full-width tables */
        table { width: 100% !important; font-size: 8.5pt !important; }
        th, td { padding: 5px 7px !important; }

        /* Badge spans */
        span[class*="inline-block"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);
    const prevTitle = document.title;
    document.title = reportId;
    window.print();
    document.title = prevTitle;
    document.head.removeChild(style);
  };

  return (
    <header
      className="report-banner w-full"
      style={{ backgroundColor: theme.primary, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
    >
      {/* ── On-screen nav bar — hidden when printing ──────────── */}
      <div
        className="print:hidden border-b px-6 flex items-center justify-between"
        style={{ minHeight: 52, borderColor: 'rgba(255,255,255,0.15)' }}
      >
        {/* Left: back + brand */}
        <div className="flex items-center gap-4 h-[52px]">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 border-r pr-4 h-full text-white/80 hover:text-white transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight uppercase text-white">LabelX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">Report</span>
          </div>
        </div>

        {/* Right: actions + user */}
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
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border border-transparent"
            style={{ backgroundColor: theme.accent, color: '#fff' }}
            title="Download as PDF"
          >
            <DownloadIcon />
            PDF
          </button>
          <ThemeSwitcher />
          <ProfileDropdown />
        </div>
      </div>

      {/* ── Print / report banner ─────────────────────────────── */}
      <div className="report-content-wrap max-w-[1600px] mx-auto px-8 py-6 flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="report-banner-title text-white text-2xl font-bold tracking-tight">LabelX Proofreading Report</h1>
          <div className="report-banner-id text-white/80 text-xs">Report ID: {reportId}</div>
        </div>
        <img src="/novintix-logo.png" alt="Novintix" className="report-banner-logo h-8 w-auto" />
      </div>
    </header>
  );
}
