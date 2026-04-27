import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeProvider } from '@/report/ThemeContext';
import { ReportHeader } from '@/report/ReportHeader';
import { MetadataRow } from '@/report/MetadataRow';
import { FrameA, FrameB, FrameC, FrameNoChange } from '@/report/Frames';
import type { ReportData, PairReportData, Requirement, DiscrepancyCategory, DrawnBox, UnexpectedChange } from '@/report/types';
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

// ── print helpers ─────────────────────────────────────────────────────────────

function _getISTDateParts() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return {
    yyyy: String(ist.getUTCFullYear()),
    mm:   String(ist.getUTCMonth() + 1).padStart(2, '0'),
    dd:   String(ist.getUTCDate()).padStart(2, '0'),
    hh:   String(ist.getUTCHours()).padStart(2, '0'),
    min:  String(ist.getUTCMinutes()).padStart(2, '0'),
  };
}

function _makePrintHandler(reportId: string): () => void {
  return () => {
    const { yyyy, mm, dd, hh, min } = _getISTDateParts();
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
        .report-banner-title { font-size: 24pt !important; font-weight: 700 !important; line-height: 1.2 !important; }
        .report-banner-id { font-size: 8.5pt !important; margin-top: 4px !important; }
        .report-banner-logo { height: 32px !important; width: auto !important; }
        .report-banner-revision { font-size: 10pt !important; font-weight: 600 !important; margin-top: 4px !important; }
        .report-metadata-bar { font-size: 8.5pt !important; }
        .report-page-break { page-break-before: always !important; break-before: page !important; display: block !important; }
        .report-page-break:last-of-type { page-break-after: auto !important; break-after: auto !important; }
        .report-label-page { page-break-inside: avoid !important; break-inside: avoid !important; }
        .report-label-img {
          max-height: 180mm !important; width: auto !important;
          max-width: 100% !important; display: block !important; margin: 0 auto !important;
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
    window.print();
    document.title = prevTitle;
    document.head.removeChild(style);
  };
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
  const baseFile        = location.state?.baseFile  as File | null | undefined;
  const childFile       = location.state?.childFile as File | null | undefined;
  const baseFileName    = location.state?.baseFileName  ?? '';
  const childFileName   = location.state?.childFileName ?? '';
  // Full arrays forwarded from PreviewPage when multiple new-version labels exist
  const childPreviewUrls: string[] = location.state?.childPreviewUrls ?? [];
  const childFileNames:   string[] = location.state?.childFileNames   ?? [];

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
  const [discardedUnexpectedIds, setDiscardedUnexpectedIds] = useState<(string | number)[]>(
    location.state?.discardedUnexpectedIds ?? []
  );

  // ── Multi-pair sidebar state ───────────────────────────────────────────────
  const [activePairIndex,    setActivePairIndex]    = useState<number>(0);
  const [checkedPairIndices, setCheckedPairIndices] = useState<Set<number>>(new Set());
  const [sidebarCollapsed,   setSidebarCollapsed]   = useState<boolean>(false);

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
  const newBoxes = buildAnnotationBoxes(annotations, formData ? reqBoxes : undefined, userBoxesNew)
    .filter((box) => !box.linkedRowId || !discardedUnexpectedIds.includes(box.linkedRowId))
    .map(box => {
      if (!box.linkedRowId) return box;
      const idx = allUnexpected.findIndex(uc => String(uc.id) === box.linkedRowId);
      return idx >= 0 ? { ...box, rowNumber: idx + 1 } : box;
    });
  const currentBoxes = buildAnnotationBoxes([], undefined, userBoxesBase)
    .filter((box) => !box.linkedRowId || !discardedUnexpectedIds.includes(box.linkedRowId));

  const { yyyy, mm, dd } = _getISTDateParts();
  const computedReportId  = `${yyyy}${mm}${dd}0001`;
  const handleDownloadPDF = _makePrintHandler(computedReportId);

  const labelVersion = formData?.metadata?.label_version ?? '';
  const revParts     = labelVersion.includes('→')
    ? labelVersion.split('→').map((s: string) => s.trim())
    : [labelVersion, ''];

  // When multiple new-version labels were uploaded, childPreviewUrls contains all
  // of their pre-rendered URLs. Fall back to the single childUrl for older paths.
  const effectiveNewUrls  = childPreviewUrls.length > 0 ? childPreviewUrls : (childUrl ? [childUrl] : []);
  const effectiveNewNames = childFileNames.length   > 0 ? childFileNames   : (childFileName ? [childFileName] : []);

  // ── Pair report data ─────────────────────────────────────────────────────
  // allPairs is set by PreviewPage whenever at least 1 result is available.
  // isMultiPair controls the multi-pair content layout (>1); the sidebar is
  // shown whenever hasSidebar (including single-pair).
  const rawPairs: any[] = location.state?.allPairs ?? [];
  const isMultiPair = rawPairs.length > 1;
  // hasSidebar is true for multi-pair AND single label uploads so the
  // collapsible sidebar is always shown when there is a label to display.
  const hasSidebar = rawPairs.length >= 1 || !!(restoredChildUrl || restoredBaseUrl || childUrl || baseUrl);

  const pairReportData: PairReportData[] = rawPairs.map((pair: any) => {
    const pairReqs = buildRequirements(pair.satisfiedItems ?? [], pair.missingItems ?? []);
    const pairAiUnexpected: UnexpectedChange[] = (pair.annotations ?? []).map((ann: any, i: number) => ({
      id:           `ai-p${pair.pairIndex}-${i}`,
      elementType:  ann.category ?? 'Text',
      changeType:   ann.change_type ?? 'Modified',
      actual:       ann.label || ann.value || ann.change_type || 'AI-detected change',
      linkedBoxIds: [`ai-p${pair.pairIndex}-${i}`],
      source:       'ai' as const,
    }));
    return {
      pairIndex:    pair.pairIndex,
      baseUrl:      pair.baseUrl,
      childUrl:     pair.childUrl,
      baseFileName: pair.baseFileName,
      childFileName: pair.childFileName,
      currentBoxes: [],
      newBoxes: buildAnnotationBoxes(pair.annotations ?? [], undefined, []),
      requirements: pairReqs,
      unexpectedChanges: pairAiUnexpected.filter(
        (item) => !discardedUnexpectedIds.includes(item.id)
      ),
      discrepancyCategories: buildDiscrepancyCategories(
        pair.parsedItems ?? [],
        pair.barcode_summary ?? null,
      ),
    };
  });

  // Aggregated summary across all pairs (used in FrameMulti header)
  const multiPairSummaryData = isMultiPair
    ? buildSummaryData(
        pairReportData.flatMap(p => p.requirements),
        pairReportData.flatMap(p => p.unexpectedChanges),
      )
    : summaryData;

  // Active pair for the sidebar-driven single-pair view
  const activePair = isMultiPair
    ? (pairReportData[activePairIndex] ?? pairReportData[0])
    : null;

  const activePairSummaryData = activePair
    ? buildSummaryData(activePair.requirements, activePair.unexpectedChanges)
    : summaryData;

  // Map active PairReportData → ReportData so FrameA can render it.
  // NOTE: reportData is defined later; build this from already-computed values
  // to avoid a temporal dead zone error.
  const activePairAsReportData: ReportData | null = activePair ? {
    reportId:              '',
    crNumber:              formData?.metadata?.cr_number   ?? '',
    sku:                   formData?.metadata?.part_number ?? '',
    currentRevision:       revParts[0] ?? '',
    newRevision:           revParts[1] ?? '',
    currentLabelName:      activePair.baseFileName,
    newLabelName:          activePair.childFileName,
    currentLabelUrl:       activePair.baseUrl  || undefined,
    newLabelUrl:           activePair.childUrl || undefined,
    newLabelUrls:          undefined,
    newLabelNames:         undefined,
    currentBoxes:          activePair.currentBoxes,
    newBoxes:              activePair.newBoxes,
    requirements:          activePair.requirements,
    unexpectedChanges:     activePair.unexpectedChanges,
    discrepancyCategories: activePair.discrepancyCategories,
  } : null;

  // Toggle-all helper for checkboxes
  const toggleSelectAll = () => {
    if (checkedPairIndices.size === pairReportData.length) {
      setCheckedPairIndices(new Set());
    } else {
      setCheckedPairIndices(new Set(pairReportData.map((_, i) => i)));
    }
  };

  // Print only the specified pair indices. Non-selected pairs are hidden via
  // injected CSS using data-pair-print attributes on their wrapper divs.
  const downloadPairs = (indices: number[]) => {
    const { yyyy, mm, dd, hh, min } = _getISTDateParts();
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min} IST`;

    const hiddenIndices = pairReportData
      .map(p => p.pairIndex)
      .filter(idx => !indices.includes(idx));
    const pairHideRules = hiddenIndices
      .map(idx => `[data-pair-print="${idx}"] { display: none !important; }`)
      .join('\n');

    const style = document.createElement('style');
    style.id = '__print-override__';
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 14mm 12mm 18mm 12mm;
        @bottom-left   { content: "LPR: ${computedReportId}"; font-size: 7pt; color: #888; font-family: sans-serif; }
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
        .report-banner { padding: 22px 28px !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .report-banner-title { font-size: 24pt !important; font-weight: 700 !important; line-height: 1.2 !important; }
        .report-banner-id { font-size: 8.5pt !important; margin-top: 4px !important; }
        .report-banner-logo { height: 32px !important; width: auto !important; }
        .report-banner-revision { font-size: 10pt !important; font-weight: 600 !important; margin-top: 4px !important; }
        .report-metadata-bar { font-size: 8.5pt !important; }
        .report-page-break { page-break-before: always !important; break-before: page !important; display: block !important; }
        .report-page-break:last-of-type { page-break-after: auto !important; break-after: auto !important; }
        .report-label-page { page-break-inside: avoid !important; break-inside: avoid !important; }
        .report-label-img { max-height: 180mm !important; width: auto !important; max-width: 100% !important; display: block !important; margin: 0 auto !important; }
        .report-section { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 0 !important; }
        .report-section:last-of-type { page-break-after: auto !important; }
        .report-section-header { page-break-after: avoid; }
        table { width: 100% !important; font-size: 8pt !important; }
        th, td { padding: 4px 6px !important; }
        span[class*="inline-block"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .report-pair-screen { display: none !important; }
        ${pairHideRules}
      }
    `;
    document.head.appendChild(style);
    const prevTitle = document.title;
    document.title = computedReportId;
    window.scrollTo(0, 0);
    window.print();
    document.title = prevTitle;
    document.head.removeChild(style);
  };

  const reportData: ReportData = {
    reportId:         '',
    crNumber:         formData?.metadata?.cr_number   ?? '',
    sku:              formData?.metadata?.part_number ?? '',
    currentRevision:  revParts[0] ?? '',
    newRevision:      revParts[1] ?? '',
    currentLabelName: baseFileName,
    newLabelName:     effectiveNewNames[0] ?? childFileName,
    currentLabelUrl:  baseUrl  || undefined,
    newLabelUrl:      effectiveNewUrls[0]  || undefined,
    // Pass the full arrays when there are multiple new-version labels
    newLabelUrls:   effectiveNewUrls.length  > 1 ? effectiveNewUrls  : undefined,
    newLabelNames:  effectiveNewNames.length > 1 ? effectiveNewNames : undefined,
    currentBoxes,
    newBoxes,
    requirements,
    unexpectedChanges: allUnexpected,
    discrepancyCategories,
    pairs: isMultiPair ? pairReportData : undefined,
  };

  const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const onDiscard = (id: string | number) =>
    setDiscardedUnexpectedIds((prev) => prev.includes(id) ? prev : [...prev, id]);

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <ReportHeader
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        reportId={reportData.reportId || undefined}
        currentRevision={reportData.currentRevision}
        newRevision={reportData.newRevision}
        onDownloadPDF={isMultiPair ? () => downloadPairs([activePairIndex]) : handleDownloadPDF}
      />
      {hasSidebar ? (
        // ── Sidebar layout (1 or more pairs) ─────────────────────────────────
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left sidebar — screen only, collapsible */}
          <aside
            className={`print:hidden relative shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col transition-[width] duration-200 ease-in-out ${
              sidebarCollapsed ? 'w-12' : 'w-60'
            }`}
          >
            <div className="flex-1 overflow-y-auto min-h-0">
              {sidebarCollapsed ? (
                /* ── Collapsed filmstrip ── */
                <div className="flex flex-col items-center gap-2 pt-3 pb-3 px-1">
                  {pairReportData.length >= 1 ? (
                    pairReportData.map((pair, i) => (
                      <button
                        key={pair.pairIndex}
                        type="button"
                        onClick={() => setActivePairIndex(i)}
                        title={pair.childFileName || `Label ${i + 1}`}
                        className={`w-9 h-9 rounded border-2 overflow-hidden flex-shrink-0 transition-all ${
                          activePairIndex === i
                            ? 'border-blue-600 ring-1 ring-blue-400'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {pair.childUrl ? (
                          <img src={pair.childUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-gray-100" />
                        )}
                      </button>
                    ))
                  ) : (
                    /* single label filmstrip */
                    <>
                      {baseUrl && (
                        <div title={baseFileName || 'Base'} className="w-9 h-9 rounded border-2 border-gray-200 overflow-hidden flex-shrink-0">
                          <img src={baseUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}
                      {childUrl && (
                        <div title={childFileName || 'New Version'} className="w-9 h-9 rounded border-2 border-blue-400 ring-1 ring-blue-300 overflow-hidden flex-shrink-0">
                          <img src={childUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ── Expanded full sidebar ── */
                <>
                  <div className="px-3 py-2.5 border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      {pairReportData.length >= 1 ? `Labels (${pairReportData.length})` : 'Labels'}
                    </span>
                    {pairReportData.length >= 1 && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="float-right text-[11px] text-blue-600 hover:underline"
                      >
                        {checkedPairIndices.size === pairReportData.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {pairReportData.length >= 1 ? (
                    <div className="divide-y divide-gray-100">
                      {pairReportData.map((pair, i) => (
                        <div
                          key={pair.pairIndex}
                          onClick={() => setActivePairIndex(i)}
                          className={`flex items-start gap-2.5 p-3 cursor-pointer transition-colors border-l-2 ${
                            activePairIndex === i
                              ? 'bg-blue-50 border-l-blue-600'
                              : 'hover:bg-gray-100 border-l-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checkedPairIndices.has(i)}
                            onChange={() => {}}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCheckedPairIndices(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            className="mt-1 flex-shrink-0 accent-blue-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            {pair.childUrl && (
                              <div className="w-full h-14 mb-1.5 bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                                <img src={pair.childUrl} alt="" className="max-w-full max-h-full object-contain" />
                              </div>
                            )}
                            <div className="text-[11px] font-semibold text-gray-700 truncate">
                              {pair.childFileName || `Label ${i + 1}`}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              Label {i + 1} of {pairReportData.length}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* single label — show base + child thumbnails */
                    <div className="flex flex-col gap-3 p-3">
                      {baseUrl && (
                        <div>
                          <div className="w-full h-16 bg-white border border-gray-200 flex items-center justify-center overflow-hidden rounded mb-1">
                            <img src={baseUrl} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="text-[10px] font-semibold text-gray-600 truncate">{baseFileName || 'Base'}</div>
                          <div className="text-[10px] text-gray-400">Current version</div>
                        </div>
                      )}
                      {childUrl && (
                        <div>
                          <div className="w-full h-16 bg-white border border-blue-200 flex items-center justify-center overflow-hidden rounded mb-1">
                            <img src={childUrl} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="text-[10px] font-semibold text-gray-600 truncate">{childFileName || 'New Version'}</div>
                          <div className="text-[10px] text-gray-400">New version</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Collapse / expand toggle button ── */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(c => !c)}
              className="absolute right-0 top-3 translate-x-1/2 z-20 rounded-full w-5 h-5 bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight size={12} className="shrink-0" />
              ) : (
                <ChevronLeft size={12} className="shrink-0" />
              )}
            </button>
          </aside>

          {/* Content column — MetadataRow + report frames, aligned after sidebar */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <MetadataRow data={activePairAsReportData ?? reportData} />

            {isMultiPair && activePairAsReportData ? (
              <>
                {/* Screen: active pair report */}
                <div className="report-pair-screen flex-1 overflow-y-auto report-content-wrap max-w-none px-8 py-6 pb-24">
                  <FrameA
                    data={activePairAsReportData}
                    summaryData={activePairSummaryData}
                    onDiscardUnexpected={onDiscard}
                  />
                </div>

                {/* Print: all pairs rendered; CSS hides non-selected via data-pair-print */}
                <div className="hidden print:block w-full report-content-wrap">
                  {pairReportData.map(pair => (
                    <div key={pair.pairIndex} data-pair-print={pair.pairIndex}>
                      <FrameA
                        data={{
                          ...reportData,
                          currentLabelName:      pair.baseFileName,
                          newLabelName:          pair.childFileName,
                          currentLabelUrl:       pair.baseUrl  || undefined,
                          newLabelUrl:           pair.childUrl || undefined,
                          newLabelUrls:          undefined,
                          newLabelNames:         undefined,
                          currentBoxes:          pair.currentBoxes,
                          newBoxes:              pair.newBoxes,
                          requirements:          pair.requirements,
                          unexpectedChanges:     pair.unexpectedChanges,
                          discrepancyCategories: pair.discrepancyCategories,
                        }}
                        summaryData={buildSummaryData(pair.requirements, pair.unexpectedChanges)}
                        onDiscardUnexpected={onDiscard}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Single pair — render scenario-appropriate frame alongside sidebar
              <div className="flex-1 overflow-y-auto report-content-wrap px-8 py-6 pb-24">
                {!hasChanges ? (
                  <FrameNoChange
                    labelName={childFileName || undefined}
                    labelUrl={childUrl || undefined}
                    baseLabelName={baseFileName || undefined}
                    baseLabelUrl={baseUrl || undefined}
                    crNumber={reportData.crNumber || undefined}
                    sku={reportData.sku || undefined}
                  />
                ) : (
                  <>
                    {activeScenario === 'A' && (
                      <FrameA data={reportData} summaryData={summaryData} onDiscardUnexpected={onDiscard} />
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
                        onDiscardUnexpected={onDiscard}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (
        // ── No pairs: single pair or no-change without sidebar ────────────────
        <>
        <MetadataRow data={reportData} />
        <div className="flex-1 report-content-wrap max-w-[1600px] mx-auto px-8 py-6 pb-24">
          {!hasChanges ? (
            <FrameNoChange
              labelName={childFileName || undefined}
              labelUrl={childUrl || undefined}
              baseLabelName={baseFileName || undefined}
              baseLabelUrl={baseUrl || undefined}
              crNumber={reportData.crNumber || undefined}
              sku={reportData.sku || undefined}
            />
          ) : (
            <>
              {activeScenario === 'A' && (
                <FrameA data={reportData} summaryData={summaryData} onDiscardUnexpected={onDiscard} />
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
                  onDiscardUnexpected={onDiscard}
                />
              )}
            </>
          )}
        </div>
        </>
      )}

      {/* ── Sticky footer — hidden during print ── */}
      {hasSidebar ? (
        <div className="print:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              {isMultiPair && checkedPairIndices.size > 0 ? (
                <>
                  <p className="text-sm font-medium text-gray-700">
                    {checkedPairIndices.size} label{checkedPairIndices.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-gray-400">Download as a combined PDF report</p>
                </>
              ) : pairReportData.length >= 1 ? (
                <>
                  <p className="text-sm font-medium text-gray-700">
                    Viewing Label {activePairIndex + 1} of {pairReportData.length}
                  </p>
                  <p className="text-xs text-gray-400">Use checkboxes to select labels for bulk download</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">Your report is ready</p>
                  <p className="text-xs text-gray-400">Generated: {generatedDate}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMultiPair && checkedPairIndices.size > 0 && (
              <button
                onClick={() => downloadPairs([...checkedPairIndices])}
                className="flex items-center gap-2 bg-[#d51900] hover:bg-red-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Selected ({checkedPairIndices.size})
              </button>
            )}
            <button
              onClick={pairReportData.length >= 1 ? () => downloadPairs([activePairIndex]) : handleDownloadPDF}
              className={`flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
                isMultiPair && checkedPairIndices.size > 0
                  ? 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                  : 'bg-[#d51900] hover:bg-red-800 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              {isMultiPair && checkedPairIndices.size > 0 ? 'Download This Label' : 'Download PDF'}
            </button>
          </div>
        </div>
      ) : (
        <div className="print:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Your report is ready</p>
              <p className="text-xs text-gray-400">Generated: {generatedDate}</p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-[#d51900] hover:bg-red-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
};

const ReportPage = () => (
  <ThemeProvider>
    <ReportPageInner />
  </ThemeProvider>
);

export default ReportPage;
