import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/report/ThemeContext';
import { ReportHeader } from '@/report/ReportHeader';
import { MetadataRow } from '@/report/MetadataRow';
import { FrameA, FrameB, FrameC, FrameNoChange } from '@/report/Frames';
import type { ReportData, Requirement, DiscrepancyCategory, DrawnBox, UnexpectedChange } from '@/report/types';
import type { ProofRequestMissingItem } from '@/data/dummyData';
import type { RequirementBox } from '@/components/VisualDiffViewer';
import { pdfToImage, isPdfFile } from '@/lib/pdfToImage';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive the ACTUAL column value for a missing (Mismatch) requirement.
 *
 * - Text/Symbol/Image: use the detected label value directly (e.g. "Belgium", "2026-01-22").
 * - Barcode/DataMatrix: the raw actualValue is a multi-line dump of decoded/printed data.
 *   We extract the child (new) label's printed value for a clean single-line summary.
 *   Falls back to "No change in the [barcode/data matrix]." when the barcode was not
 *   updated, matching the PDF report format.
 * - If nothing was detected ("—" or empty) → "— NOT FOUND —"
 */
function resolveMissingActual(item: ProofRequestMissingItem): string {
  const raw = item.actualValue ?? '';
  if (!raw || raw === '—') return '— NOT FOUND —';

  if (item.category === 'Barcode' || item.category === 'DataMatrix') {
    // Multi-line dump — extract the child printed value if present
    const lines = raw.split('\n');
    const childPrinted = lines.find(l => l.startsWith('Child printed:'));
    if (childPrinted) {
      const val = childPrinted.replace('Child printed:', '').trim();
      if (val && val !== '(none)') return val;
    }
    const childDecoded = lines.find(l => l.startsWith('Child decoded:'));
    if (childDecoded) {
      const val = childDecoded.replace('Child decoded:', '').trim();
      if (val && val !== '(none)') return val;
    }
    // No meaningful child value — barcode was not updated
    const label = item.category === 'DataMatrix' ? 'data matrix' : 'barcode';
    return `No change in the ${label}.`;
  }

  return raw;
}

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
      actualValue:   item.actualValue ?? item.expectedValue,
      status: 'Match' as const,
    })),
    ...missingItems.map((item) => ({
      id: id++,
      elementType: item.category as Requirement['elementType'],
      changeType:  item.expectedChange as Requirement['changeType'],
      description: item.label,
      expectedValue: item.expectedValue,
      actualValue:   resolveMissingActual(item),
      status: 'Mismatch' as const,
    })),
  ];
}

function buildManualExpectedRequirements(items: any[], startId: number): Requirement[] {
  let id = startId;
  return items.map((item) => ({
    id: id++,
    elementType: (item.elementType ?? 'Text') as Requirement['elementType'],
    changeType: (item.type ?? 'Modified') as Requirement['changeType'],
    description: item.text || 'Reviewer-marked expected change',
    expectedValue: item.text || '—',
    actualValue: item.text || '—',
    status: 'Match' as const,
  }));
}

function _isBarcodeDataMatrix(barcodeType: string): boolean {
  const t = barcodeType.toLowerCase();
  return t.includes('datamatrix') || t.includes('data_matrix') || t.includes('matrix');
}

function _barcodeChangeDesc(ch: any): string {
  const ov = ch.old_value || ch.old_printed || '';
  const nv = ch.new_value || ch.new_printed || '';
  const ct = (ch.change_type || 'Modified').toLowerCase();
  if (ct === 'modified') return `From: '${ov}' \u2794 To: '${nv}'`;
  if (ct === 'added')    return nv || 'Barcode added';
  if (ct === 'deleted')  return ov || 'Barcode removed';
  return ov || nv;
}

function buildDiscrepancyCategories(parsedItems: any[], barcodeSummary?: any): DiscrepancyCategory[] {
  const ORDER = ['Text', 'Symbol', 'Barcode', 'DataMatrix', 'Image'];
  const TITLE: Record<string, string> = {
    Text: 'TEXT', Symbol: 'SYMBOLS', Barcode: 'BARCODES', DataMatrix: 'DATAMATRIX', Image: 'IMAGE',
  };
  const map: Record<string, { changeType: any; value: string }[]> = {};
  for (const item of parsedItems) {
    const title = TITLE[item.category] ?? item.category.toUpperCase();
    if (!map[title]) map[title] = [];
    map[title].push({ changeType: item.status, value: item.value });
  }
  for (const ch of (barcodeSummary?.comparison?.changes ?? [])) {
    const isMatrix = _isBarcodeDataMatrix(ch.barcode_type || '');
    const title    = isMatrix ? 'DATAMATRIX' : 'BARCODES';
    if (!map[title]) map[title] = [];
    map[title].push({ changeType: ch.change_type ?? 'Modified', value: _barcodeChangeDesc(ch) });
  }
  return ORDER
    .map((cat) => TITLE[cat])
    .filter((title) => map[title]?.length)
    .map((title) => ({ title, items: map[title] }));
}

function buildSummaryData(requirements: Requirement[], unexpectedChanges: UnexpectedChange[]) {
  const empty = () => ({ text: 0, symbol: 0, barcode: 0, datamatrix: 0, image: 0, other: 0 });
  const data = { deleted: empty(), added: empty(), modified: empty(), misplaced: empty() };
  const catKey: Record<string, keyof ReturnType<typeof empty>> = {
    Text: 'text', Symbol: 'symbol', Barcode: 'barcode', DataMatrix: 'datamatrix', Image: 'image',
  };
  // Maps both legacy API values (Added/Deleted/Modified) and current form
  // values (Add/Remove/Modify) to the same summary bucket.
  const statusKey: Record<string, keyof typeof data> = {
    Added: 'added',    Add: 'added',
    Deleted: 'deleted', Remove: 'deleted',
    Modified: 'modified', Modify: 'modified',
    Repositioned: 'misplaced', Misplaced: 'misplaced',
  };
  for (const req of requirements) {
    if (req.status !== 'Match') continue;   // only count verified matches
    const sk = statusKey[req.changeType];
    const ck = catKey[req.elementType];
    if (sk && ck) data[sk][ck]++;
  }
  // Unexpected changes (Reviewer Notes) don't map to a standard element type,
  // so they go into 'other' — still counted in header totals but not in the breakdown grid.
  for (const uc of unexpectedChanges) {
    const sk = statusKey[uc.changeType as string] ?? 'modified';
    data[sk].other++;
  }
  return data;
}


function buildAnnotationBoxes(
  annotations: any[],
  requirementBoxes?: RequirementBox[],
  userBoxes?: DrawnBox[],
): DrawnBox[] {
  let base: DrawnBox[];

  if (requirementBoxes && requirementBoxes.length > 0) {
    base = requirementBoxes.map((box, i) => {
      const ct   = (box.changeType ?? 'Modified');
      const type = (
        ct === 'Added'   || ct === 'Add'    ? 'Added'   :
        ct === 'Deleted' || ct === 'Remove' ? 'Deleted' :
        'Modified'
      ) as DrawnBox['type'];
      return {
        id:     `req-${box.id ?? i}`,
        type,
        top:    box.y      * 100,
        left:   box.x      * 100,
        width:  box.width  * 100,
        height: box.height * 100,
        text:   box.label,
        elementType: box.category,
      };
    });
  } else {
    base = annotations.map((ann, i) => ({
      id:     `ann-${i}`,
      type:   ann.change_type as DrawnBox['type'],
      top:    ann.y      * 100,
      left:   ann.x      * 100,
      width:  ann.width  * 100,
      height: ann.height * 100,
      text:   ann.label,
      elementType: ann.category,
      linkedRowId: `ai-${i}`,
    }));
  }

  // Append user-drawn annotations from the preview page
  if (userBoxes && userBoxes.length > 0) {
    base = [
      ...base,
      ...userBoxes.map((box) => ({
        ...box,
        linkedRowId: box.linkedRowId ?? (box.groupId ? `user-${box.groupId}` : undefined),
      })),
    ];
  }

  return base;
}

// ── inner page ────────────────────────────────────────────────────────────────

const ReportPageInner = () => {
  const location = useLocation();
  const initialScenario = (location.state?.scenario as 'A' | 'B' | 'C') ?? 'A';
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C'>(initialScenario);

  // hasChanges is set by PreviewPage based on whether the user annotated anything
  // or form requirements produced results. Default true so existing direct
  // navigations (bypassing PreviewPage) are unaffected.
  const hasChanges: boolean = location.state?.hasChanges ?? true;

  const formData       = location.state?.formData;
  const parsedItems    = location.state?.parsedItems    ?? [];
  const missingItems   = location.state?.missingItems   ?? [];
  const satisfiedItems = location.state?.satisfiedItems ?? [];
  const annotations    = location.state?.annotations    ?? [];
  const reqBoxes       = location.state?.requirementBoxes as RequirementBox[] | undefined;
  const barcodeSummary = location.state?.barcode_summary ?? null;
  const baseFile       = location.state?.baseFile  as File | null | undefined;
  const childFile      = location.state?.childFile as File | null | undefined;
  const baseFileName   = location.state?.baseFileName  ?? '';
  const childFileName  = location.state?.childFileName ?? '';

  // User-drawn annotation boxes from the preview page (all boxes → visual overlay)
  const userBoxesBase: DrawnBox[] = location.state?.userAnnotationsBase ?? [];
  const userBoxesNew:  DrawnBox[] = location.state?.userAnnotationsNew  ?? [];

  // Deduplicated annotations (one per group) from preview decisions
  const userAnnotationsUnique: any[] =
    location.state?.userAnnotationsUnique ?? [...userBoxesBase, ...userBoxesNew];
  const userExpectedUnique: any[] =
    location.state?.userExpectedUnique ?? userAnnotationsUnique.filter((b: any) => b.disposition === 'Expected');
  const userUnexpectedUnique: any[] =
    location.state?.userUnexpectedUnique ?? userAnnotationsUnique.filter((b: any) => b.disposition !== 'Expected');

  const userUnexpected: UnexpectedChange[] = userUnexpectedUnique.map((b, i) => ({
    id:          `user-${b.groupId ?? i}`,
    elementType: b.elementType ?? 'Reviewer Note',
    changeType:  b.type,
    actual:      b.text || b.type,
    linkedBoxIds: [`user-${b.groupId ?? i}`],
    source: 'reviewer',
  }));

  const aiUnexpected: UnexpectedChange[] = annotations.map((ann: any, i: number) => ({
    id: `ai-${i}`,
    elementType: ann.category ?? 'Text',
    changeType: ann.change_type ?? 'Modified',
    actual: ann.label || ann.value || ann.change_type || 'AI-detected unexpected change',
    linkedBoxIds: [`ai-${i}`],
    source: 'ai',
  }));

  // Prefer URLs forwarded through location.state — the full Index → Preview →
  // Report chain is multi-hop and File objects may not survive intact. The
  // preview URLs (data URLs for PDFs, blob URLs for images) are plain strings
  // that do survive, so use them directly and only fall back to rebuilding
  // from File when no URL was forwarded.
  const restoredBaseUrl  = (location.state?.basePreviewUrl  as string | undefined) ?? '';
  const restoredChildUrl = (location.state?.childPreviewUrl as string | undefined) ?? '';
  const [baseUrl,  setBaseUrl]  = useState<string>(restoredBaseUrl);
  const [childUrl, setChildUrl] = useState<string>(restoredChildUrl);
  const restoredBaseUrlRef  = useRef<boolean>(!!restoredBaseUrl);
  const restoredChildUrlRef = useRef<boolean>(!!restoredChildUrl);
  const [discardedUnexpectedIds, setDiscardedUnexpectedIds] = useState<(string | number)[]>([]);

  useEffect(() => {
    if (!baseFile) {
      if (!restoredBaseUrlRef.current) setBaseUrl('');
      return;
    }
    restoredBaseUrlRef.current = false;
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        if (isPdfFile(baseFile)) {
          const dataUrl = await pdfToImage(baseFile);
          if (!cancelled) setBaseUrl(dataUrl);
        } else {
          blobUrl = URL.createObjectURL(baseFile);
          if (!cancelled) setBaseUrl(blobUrl);
        }
      } catch (e) {
        console.error('Failed to build base label URL:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [baseFile]);

  useEffect(() => {
    if (!childFile) {
      if (!restoredChildUrlRef.current) setChildUrl('');
      return;
    }
    restoredChildUrlRef.current = false;
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        if (isPdfFile(childFile)) {
          const dataUrl = await pdfToImage(childFile);
          if (!cancelled) setChildUrl(dataUrl);
        } else {
          blobUrl = URL.createObjectURL(childFile);
          if (!cancelled) setChildUrl(blobUrl);
        }
      } catch (e) {
        console.error('Failed to build child label URL:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [childFile]);

  const baseRequirements = buildRequirements(satisfiedItems, missingItems);
  const requirements     = [
    ...baseRequirements,
    ...buildManualExpectedRequirements(userExpectedUnique, baseRequirements.length + 1),
  ];
  const discrepancyCategories = buildDiscrepancyCategories(parsedItems, barcodeSummary);

  const allUnexpected = [...aiUnexpected, ...userUnexpected].filter(
    (item) => !discardedUnexpectedIds.includes(item.id)
  );

  const summaryData           = buildSummaryData(requirements, allUnexpected);

  // Annotation boxes for the label comparison images
  const newBoxes     = buildAnnotationBoxes(annotations, formData ? reqBoxes : undefined, userBoxesNew)
    .filter((box) => !box.linkedRowId || !discardedUnexpectedIds.includes(box.linkedRowId));
  const currentBoxes = buildAnnotationBoxes([], undefined, userBoxesBase)
    .filter((box) => !box.linkedRowId || !discardedUnexpectedIds.includes(box.linkedRowId));

  const labelVersion = formData?.metadata?.label_version ?? '';
  const revParts     = labelVersion.includes('→')
    ? labelVersion.split('→').map((s: string) => s.trim())
    : [labelVersion, ''];

  const reportData: ReportData = {
    reportId:         '',
    crNumber:         formData?.metadata?.cr_number   ?? '',
    sku:              formData?.metadata?.part_number ?? '',
    currentRevision:  revParts[0] ?? '',
    newRevision:      revParts[1] ?? '',
    currentLabelName: baseFileName,
    newLabelName:     childFileName,
    currentLabelUrl:  baseUrl  || undefined,
    newLabelUrl:      childUrl || undefined,
    currentBoxes,
    newBoxes,
    requirements,
    unexpectedChanges: allUnexpected,
    discrepancyCategories,
  };

  return (
    <div className="min-h-screen bg-white">
      <ReportHeader
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        reportId={reportData.reportId || undefined}
        currentRevision={reportData.currentRevision}
        newRevision={reportData.newRevision}
      />
      <MetadataRow data={reportData} />
      <div className="report-content-wrap max-w-[1600px] mx-auto px-8 py-6">
        {!hasChanges ? (
          <FrameNoChange
            labelName={childFileName || baseFileName || undefined}
            labelUrl={childUrl || baseUrl || undefined}
            crNumber={reportData.crNumber || undefined}
            sku={reportData.sku || undefined}
          />
        ) : (
          <>
            {activeScenario === 'A' && (
              <FrameA
                data={reportData}
                summaryData={summaryData}
                onDiscardUnexpected={(id) => setDiscardedUnexpectedIds((prev) => prev.includes(id) ? prev : [...prev, id])}
              />
            )}
            {activeScenario === 'B' && (
              <FrameB formData={formData} summaryData={summaryData} />
            )}
            {activeScenario === 'C' && (
              <FrameC
                data={reportData}
                formData={formData}
                summaryData={summaryData}
                satisfiedItems={satisfiedItems}
                missingItems={missingItems}
                onDiscardUnexpected={(id) => setDiscardedUnexpectedIds((prev) => prev.includes(id) ? prev : [...prev, id])}
              />
            )}
          </>
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
