import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/report/ThemeContext';
import { ReportHeader } from '@/report/ReportHeader';
import { MetadataRow } from '@/report/MetadataRow';
import { FrameA, FrameB, FrameC } from '@/report/Frames';
import type { ReportData, Requirement, DiscrepancyCategory, DrawnBox } from '@/report/types';
import type { ProofRequestMissingItem } from '@/data/dummyData';

// ── helpers ───────────────────────────────────────────────────────────────────

function buildRequirements(
  satisfiedItems: ProofRequestMissingItem[],
  missingItems: ProofRequestMissingItem[],
): Requirement[] {
  let id = 1;
  return [
    ...satisfiedItems.map((item) => ({
      id: id++,
      elementType: item.category as Requirement['elementType'],
      changeType:  item.expectedChange as Requirement['changeType'],
      description: item.label,
      expectedValue: item.expectedValue,
      actualValue:   item.expectedValue,
      status: 'Match' as const,
    })),
    ...missingItems.map((item) => ({
      id: id++,
      elementType: item.category as Requirement['elementType'],
      changeType:  item.expectedChange as Requirement['changeType'],
      description: item.label,
      expectedValue: item.expectedValue,
      actualValue:   '— NOT FOUND —',
      status: 'Unmatch' as const,
    })),
  ];
}

function buildDiscrepancyCategories(parsedItems: any[]): DiscrepancyCategory[] {
  const ORDER = ['Text', 'Symbol', 'Barcode', 'Image'];
  const TITLE: Record<string, string> = {
    Text: 'TEXT', Symbol: 'SYMBOLS', Barcode: 'BARCODES', Image: 'IMAGE',
  };
  const map: Record<string, { changeType: any; value: string }[]> = {};
  for (const item of parsedItems) {
    const title = TITLE[item.category] ?? item.category.toUpperCase();
    if (!map[title]) map[title] = [];
    map[title].push({ changeType: item.status, value: item.value });
  }
  return ORDER
    .map((cat) => TITLE[cat])
    .filter((title) => map[title]?.length)
    .map((title) => ({ title, items: map[title] }));
}

function buildSummaryData(parsedItems: any[]) {
  const empty = () => ({ text: 0, symbol: 0, barcode: 0, image: 0 });
  const data = { deleted: empty(), added: empty(), modified: empty(), misplaced: empty() };
  const catKey: Record<string, keyof ReturnType<typeof empty>> = {
    Text: 'text', Symbol: 'symbol', Barcode: 'barcode', Image: 'image',
  };
  const statusKey: Record<string, keyof typeof data> = {
    Deleted: 'deleted', Added: 'added', Modified: 'modified', Repositioned: 'misplaced',
  };
  for (const item of parsedItems) {
    const sk = statusKey[item.status];
    const ck = catKey[item.category];
    if (sk && ck) data[sk][ck]++;
  }
  return data;
}

function buildAnnotationBoxes(annotations: any[]): DrawnBox[] {
  return annotations.map((ann, i) => ({
    id: `ann-${i}`,
    type: ann.change_type as DrawnBox['type'],
    top:    ann.y      * 100,
    left:   ann.x      * 100,
    width:  ann.width  * 100,
    height: ann.height * 100,
    text:   ann.label,
  }));
}

// ── inner page ────────────────────────────────────────────────────────────────

const ReportPageInner = () => {
  const location = useLocation();
  const initialScenario = (location.state?.scenario as 'A' | 'B' | 'C') ?? 'A';
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C'>(initialScenario);

  // Raw state from navigate
  const formData       = location.state?.formData;
  const parsedItems    = location.state?.parsedItems    ?? [];
  const missingItems   = location.state?.missingItems   ?? [];
  const satisfiedItems = location.state?.satisfiedItems ?? [];
  const annotations    = location.state?.annotations    ?? [];
  const baseFile       = location.state?.baseFile       as File | null | undefined;
  const childFile      = location.state?.childFile      as File | null | undefined;
  const baseFileName   = location.state?.baseFileName   ?? '';
  const childFileName  = location.state?.childFileName  ?? '';

  // Create stable object URLs from File objects so they survive the navigation
  const [baseUrl,  setBaseUrl]  = useState('');
  const [childUrl, setChildUrl] = useState('');

  useEffect(() => {
    if (!baseFile) return;
    const url = URL.createObjectURL(baseFile);
    setBaseUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [baseFile]);

  useEffect(() => {
    if (!childFile) return;
    const url = URL.createObjectURL(childFile);
    setChildUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [childFile]);

  // Build structured data for every report component
  const requirements          = buildRequirements(satisfiedItems, missingItems);
  const discrepancyCategories = buildDiscrepancyCategories(parsedItems);
  const summaryData           = buildSummaryData(parsedItems);
  const newBoxes              = buildAnnotationBoxes(annotations);

  const labelVersion   = formData?.metadata?.label_version ?? '';
  const revParts       = labelVersion.includes('→') ? labelVersion.split('→').map((s: string) => s.trim()) : [labelVersion, ''];

  const reportData: ReportData = {
    reportId:         '',
    crNumber:         formData?.metadata?.cr_number    ?? '',
    sku:              formData?.metadata?.part_number  ?? '',
    currentRevision:  revParts[0] ?? '',
    newRevision:      revParts[1] ?? '',
    currentLabelName: baseFileName,
    newLabelName:     childFileName,
    currentLabelUrl:  baseUrl  || undefined,
    newLabelUrl:      childUrl || undefined,
    currentBoxes:     [],
    newBoxes,
    requirements,
    discrepancyCategories,
  };

  return (
    <div className="min-h-screen bg-white">
      <ReportHeader
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        reportId={reportData.reportId || undefined}
      />
      <MetadataRow data={reportData} />
      <div className="report-content-wrap max-w-[1600px] mx-auto px-8 py-6">
        {activeScenario === 'A' && (
          <FrameA
            data={reportData}
            summaryData={summaryData}
          />
        )}
        {activeScenario === 'B' && <FrameB formData={formData} />}
        {activeScenario === 'C' && (
          <FrameC
            data={reportData}
            formData={formData}
            summaryData={summaryData}
            satisfiedItems={satisfiedItems}
            missingItems={missingItems}
          />
        )}
      </div>
    </div>
  );
};

const ReportPage = () => (
  <ThemeProvider>
    <ReportPageInner />
  </ThemeProvider>
);

export default ReportPage;
