import { ReportInspectionSummary } from './InspectionSummary';
import { LabelComparison } from './LabelComparison';
import { MissingChanges } from './MissingChanges';
import { ExpectedChanges } from './ExpectedChanges';
import { UnexpectedChanges } from './UnexpectedChanges';
import { useTheme } from './ThemeContext';
import type { ReportData, PairReportData } from './types';
import type { ProofRequestMissingItem } from '@/data/dummyData';

interface FormData {
  changes: Record<string, { changeType: string; expectedValue: string }>;
}

interface DynamicProps {
  data?: ReportData;
  formData?: FormData;
  summaryData?: any;
  satisfiedItems?: ProofRequestMissingItem[];
  missingItems?: ProofRequestMissingItem[];
  onDiscardUnexpected?: (id: string | number) => void;
}

interface NoChangeProps {
  labelName?: string;
  labelUrl?:  string;
  crNumber?:  string;
  sku?:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene A — Direct comparison (no form, plain AI comparison)
//   Page 1: Changes Summary
//   Page 2: Label Comparison
//   Page 3: Unexpected Changes + Inspection Summary
// ─────────────────────────────────────────────────────────────────────────────
export function FrameA({ data, summaryData, onDiscardUnexpected }: Pick<DynamicProps, 'data' | 'summaryData' | 'onDiscardUnexpected'>) {
  return (
    <div className="report-section space-y-6">
      {/* Page 1 — Requirements/Changes summary */}
      <MissingChanges requirements={data?.requirements ?? []} />

      {/* Page 2 — Label comparison */}
      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl}
          currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}
          newLabelName={data?.newLabelName}
          newLabelUrls={data?.newLabelUrls}
          newLabelNames={data?.newLabelNames}
          currentBoxes={data?.currentBoxes}
          newBoxes={data?.newBoxes}
        />
      </div>

      {/* Page 3 — Report Details */}
      <div className="report-page-break space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Report Details</h3>
        <ExpectedChanges requirements={data?.requirements} />
        <UnexpectedChanges changes={data?.unexpectedChanges ?? []} onDiscard={onDiscardUnexpected} />
        <ReportInspectionSummary data={summaryData} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene B — Form only (no comparison, no AI)
//   Page 1: Requirements Summary
//   Page 2: Expected Changes (tabbed form view)
//   Page 3: Master label
//   Page 4: Inspection Summary
// ─────────────────────────────────────────────────────────────────────────────
export function FrameB({ formData, summaryData }: { formData?: FormData; summaryData?: any }) {
  return (
    <div className="report-section space-y-6">
      <MissingChanges />

      <div className="report-page-break">
        <ExpectedChanges formData={formData} />
      </div>

      <div className="report-page-break report-label-page">
        <LabelComparison show="master" />
      </div>

      <div className="report-page-break space-y-6">
        <ReportInspectionSummary data={summaryData} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene C — Full comparison (form + AI) — matches the exact PDF template
//   Page 1: Requirements Summary (5 cols: # | Element | Change Type | Requirements | Expected)
//   Page 2: Label Comparison (legend + stacked Current / New)
//   Page 3: Report Details
//             — Expected Changes (7-col table with Actual + Status)
//             — Unexpected Changes (4-col, AI-detected items outside requirements)
//             — Inspection Summary
// ─────────────────────────────────────────────────────────────────────────────
export function FrameC({ data, formData, summaryData, satisfiedItems, missingItems, onDiscardUnexpected }: DynamicProps) {
  return (
    <div className="report-section space-y-6">
      {/* Page 1 — Requirements Summary */}
      <MissingChanges requirements={data?.requirements ?? []} />

      {/* Page 2 — Label Comparison */}
      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl}
          currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}
          newLabelName={data?.newLabelName}
          newLabelUrls={data?.newLabelUrls}
          newLabelNames={data?.newLabelNames}
          currentBoxes={data?.currentBoxes}
          newBoxes={data?.newBoxes}
        />
      </div>

      {/* Page 3 — Report Details */}
      <div className="report-page-break space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Report Details</h3>

        {/* Expected Changes — unified 7-column table */}
        <ExpectedChanges requirements={data?.requirements} />

        {/* Unexpected Changes — always visible; shows placeholder when none found */}
        <UnexpectedChanges changes={data?.unexpectedChanges ?? []} onDiscard={onDiscardUnexpected} />

        {/* Inspection Summary */}
        <ReportInspectionSummary data={summaryData} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene No Change — Label reviewed with no changes identified
//   Single page: confirmation banner + full label image
// ─────────────────────────────────────────────────────────────────────────────
export function FrameNoChange({ labelName, labelUrl, crNumber, sku }: NoChangeProps) {
  const { theme } = useTheme();

  return (
    <div className="report-section space-y-6">
      {/* Confirmation banner */}
      <div className="bg-white border border-gray-300 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            {(crNumber || sku) && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {crNumber && <span>CR: <span className="font-bold text-gray-700">{crNumber}</span></span>}
                {sku      && <span>SKU: <span className="font-bold text-gray-700">{sku}</span></span>}
              </div>
            )}
            {labelName && (
              <div className="text-sm font-semibold text-gray-800">{labelName}</div>
            )}
          </div>
          {/* No Change badge */}
          <div
            className="flex items-center gap-2 px-4 py-2 border text-sm font-bold uppercase tracking-widest"
            style={{ backgroundColor: `${theme.statusColors.added}15`, color: theme.statusColors.added, borderColor: `${theme.statusColors.added}60` }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            No Change
          </div>
        </div>

        {/* Horizontal rule with status text */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Label reviewed — no changes identified</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Inspection summary row */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Add',    count: 0, color: theme.statusColors.added },
            { label: 'Remove', count: 0, color: theme.statusColors.deleted },
            { label: 'Modify', count: 0, color: theme.statusColors.modified },
          ].map(({ label, count, color }) => (
            <div key={label} className="border border-gray-200 py-3">
              <div className="text-lg font-bold" style={{ color }}>{count}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Label image — full width */}
      <div className="report-label-page bg-white border border-gray-300 p-4">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-3">Label</div>
        {labelUrl ? (
          <img
            src={labelUrl}
            alt={labelName ?? 'Label'}
            className="w-full object-contain"
            style={{ maxHeight: '600px' }}
          />
        ) : (
          <div className="flex items-center justify-center h-48 bg-gray-50 border border-dashed border-gray-300 text-sm text-gray-400 italic">
            No label image provided
          </div>
        )}
        {labelName && (
          <div className="mt-2 text-[10px] text-gray-400 text-center">{labelName}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FrameMulti — Multiple label pairs (N base labels vs N new labels)
//   Renders one comparison block per pair, each with its own label images and
//   change tables. An aggregated Requirements Summary appears at the top and a
//   single Inspection Summary at the bottom.
// ─────────────────────────────────────────────────────────────────────────────

interface MultiPairProps {
  pairs: PairReportData[];
  summaryData?: any;
  onDiscardUnexpected?: (id: string | number) => void;
}

export function FrameMulti({ pairs, summaryData, onDiscardUnexpected }: MultiPairProps) {
  const allRequirements = pairs.flatMap(p => p.requirements);

  return (
    <div className="report-section space-y-6">
      {/* Aggregated requirements summary across all pairs */}
      <MissingChanges requirements={allRequirements} />

      {/* One block per label pair */}
      {pairs.map((pair, i) => (
        <div key={pair.pairIndex} className="report-page-break space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>

          {/* Pair heading */}
          <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Label {i + 1} of {pairs.length}
            </span>
            {(pair.baseFileName || pair.childFileName) && (
              <span className="text-[10px] text-gray-500 truncate">
                {pair.baseFileName}{pair.baseFileName && pair.childFileName ? ' → ' : ''}{pair.childFileName}
              </span>
            )}
          </div>

          {/* Label comparison images */}
          <div className="report-label-page">
            <LabelComparison
              currentLabelUrl={pair.baseUrl || undefined}
              currentLabelName={pair.baseFileName || undefined}
              newLabelUrl={pair.childUrl || undefined}
              newLabelName={pair.childFileName || undefined}
              currentBoxes={pair.currentBoxes}
              newBoxes={pair.newBoxes}
            />
          </div>

          {/* Per-pair change tables */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
              Report Details — Label {i + 1}
            </h3>
            <ExpectedChanges requirements={pair.requirements} />
            <UnexpectedChanges
              changes={pair.unexpectedChanges}
              onDiscard={onDiscardUnexpected}
            />
          </div>
        </div>
      ))}

      {/* Single aggregated inspection summary at the end */}
      <div className="report-page-break">
        <ReportInspectionSummary data={summaryData} />
      </div>
    </div>
  );
}
