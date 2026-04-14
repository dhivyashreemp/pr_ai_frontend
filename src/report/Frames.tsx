import { ReportInspectionSummary } from './InspectionSummary';
import { LabelComparison } from './LabelComparison';
import { MissingChanges } from './MissingChanges';
import { ExpectedChanges } from './ExpectedChanges';
import { UnexpectedChanges } from './UnexpectedChanges';
import type { ReportData } from './types';
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene A — Direct comparison (no form, plain AI comparison)
//   Page 1: Changes Summary
//   Page 2: Label Comparison
//   Page 3: Unexpected Changes + Inspection Summary
// ─────────────────────────────────────────────────────────────────────────────
export function FrameA({ data, summaryData }: Pick<DynamicProps, 'data' | 'summaryData'>) {
  return (
    <div className="report-section space-y-6">
      {/* Page 1 — Requirements/Changes summary */}
      <MissingChanges requirements={data?.requirements?.length ? data.requirements : undefined} />

      {/* Page 2 — Label comparison */}
      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl}
          currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}
          newLabelName={data?.newLabelName}
          currentBoxes={data?.currentBoxes}
          newBoxes={data?.newBoxes}
        />
      </div>

      {/* Page 3 — Report Details */}
      <div className="report-page-break space-y-6">
        <ExpectedChanges requirements={data?.requirements} />
        {data?.unexpectedChanges && data.unexpectedChanges.length > 0 && (
          <UnexpectedChanges changes={data.unexpectedChanges} />
        )}
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
export function FrameB({ formData }: { formData?: FormData }) {
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
        <ReportInspectionSummary />
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
export function FrameC({ data, formData, summaryData, satisfiedItems, missingItems }: DynamicProps) {
  return (
    <div className="report-section space-y-6">
      {/* Page 1 — Requirements Summary */}
      <MissingChanges requirements={data?.requirements?.length ? data.requirements : undefined} />

      {/* Page 2 — Label Comparison */}
      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl}
          currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}
          newLabelName={data?.newLabelName}
          currentBoxes={data?.currentBoxes}
          newBoxes={data?.newBoxes}
        />
      </div>

      {/* Page 3 — Report Details */}
      <div className="report-page-break space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Report Details</h3>

        {/* Expected Changes — unified 7-column table */}
        <ExpectedChanges requirements={data?.requirements} />

        {/* Unexpected Changes — AI-detected items not in requirements */}
        {data?.unexpectedChanges && data.unexpectedChanges.length > 0 && (
          <UnexpectedChanges changes={data.unexpectedChanges} />
        )}

        {/* Inspection Summary */}
        <ReportInspectionSummary data={summaryData} />
      </div>
    </div>
  );
}
