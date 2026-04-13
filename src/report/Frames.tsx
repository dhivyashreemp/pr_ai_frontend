import { ReportInspectionSummary } from './InspectionSummary';
import { LabelComparison } from './LabelComparison';
import { ReportDiscrepancyDetails } from './DiscrepancyDetails';
import { MissingChanges } from './MissingChanges';
import { ExpectedChanges } from './ExpectedChanges';
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

// Scene 1 → Existing + Master (no form, plain AI comparison)
// Page 1: Requirements Summary
// Page 2: Label Comparison
// Page 3: Inspection Summary + Changes Made
export function FrameA({ data, summaryData }: Pick<DynamicProps, 'data' | 'summaryData'>) {
  return (
    <div className="report-section space-y-6">
      <MissingChanges requirements={data?.requirements?.length ? data.requirements : undefined} />

      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl} currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}          newLabelName={data?.newLabelName}
          currentBoxes={data?.currentBoxes}        newBoxes={data?.newBoxes}
        />
      </div>

      <div className="report-page-break space-y-6">
        <ReportInspectionSummary data={summaryData} />
        <ReportDiscrepancyDetails categories={data?.discrepancyCategories} />
      </div>
    </div>
  );
}

// Scene 3 → Supportive + Master (form only, no comparison)
// Page 1: Requirements Summary
// Page 2: Expected Changes (all categories)
// Page 3: Label Comparison (master only)
// Page 4: Inspection Summary + Changes Made
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
        <ReportDiscrepancyDetails />
      </div>
    </div>
  );
}

// Scene 2 → Full Comparison (form + AI comparison)
// Page 1: Requirements Summary
// Page 2: Expected Changes (all categories)
// Page 3: Label Comparison (both)
// Page 4: Inspection Summary + Changes Made
export function FrameC({ data, formData, summaryData, satisfiedItems, missingItems }: DynamicProps) {
  return (
    <div className="report-section space-y-6">
      <MissingChanges requirements={data?.requirements?.length ? data.requirements : undefined} />

      <div className="report-page-break">
        <ExpectedChanges
          formData={formData}
          satisfiedItems={satisfiedItems}
          missingItems={missingItems}
        />
      </div>

      <div className="report-page-break report-label-page">
        <LabelComparison
          currentLabelUrl={data?.currentLabelUrl} currentLabelName={data?.currentLabelName}
          newLabelUrl={data?.newLabelUrl}          newLabelName={data?.newLabelName}
          currentBoxes={data?.currentBoxes}        newBoxes={data?.newBoxes}
        />
      </div>

      <div className="report-page-break space-y-6">
        <ReportInspectionSummary data={summaryData} />
        <ReportDiscrepancyDetails categories={data?.discrepancyCategories} />
      </div>
    </div>
  );
}
