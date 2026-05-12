import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { API_URL } from "@/constants";
import { Download, RefreshCw, FileText, AlertCircle, Play, ScanLine, ArrowLeft } from "lucide-react";
import AnalysisProgressModal from "@/components/AnalysisProgressModal";
import ReadingPdfModal from "@/components/ReadingPdfModal";
import { CompareProgress } from "@/components/CompareProgress";
import { useCompareStream } from "@/hooks/useCompareStream";
import { useLocation, useNavigate } from "react-router-dom";
import Dropzone from "@/components/Dropzone";
import VisualDiffViewer, { type RequirementBox, type Annotation } from "@/components/VisualDiffViewer";
import DataTables from "@/components/DataTables";
import LabelSidebar from "@/components/LabelSidebar";
import { pdfToImage, pdfToImageFiles, isPdfFile } from "@/lib/pdfToImage";
import { authFetch } from "@/lib/authFetch";
import ProfileDropdown from "@/components/ProfileDropdown";
import StepIndicator from "@/components/StepIndicator";
import { toast } from "sonner";
import { CATEGORIES } from "@/data/attributes";
import type { ProofRequestMissingItem } from "@/data/dummyData";
import { processApiResult, type ProcessedApiResult } from "@/utils/resultProcessing";

function generateReportId(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const dateKey = `${yyyy}${mm}${dd}`;
  const storageKey = `lpr_counter_${dateKey}`;
  const last = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
  const next = last + 1;
  localStorage.setItem(storageKey, String(next));
  return `${dateKey}${String(next).padStart(4, '0')}`;
}

/** When a PDF is expanded to per-page PNGs, return the expanded name with .pdf extension. */
const pdfPageName = (expanded: string | undefined, original: string | undefined): string =>
  expanded && original && /\.pdf$/i.test(original)
    ? expanded.replace(/\.png$/i, '.pdf')
    : (expanded ?? original ?? '');

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const formData = location.state?.formData;
  const submissionId: string | null = location.state?.submissionId ?? null;
  const restoredUserAnnotations: any[] = location.state?.userAnnotations ?? [];

  const [baseFile, setBaseFile] = useState<File[]>(location.state?.baseFile || []);
  const [childFiles, setChildFiles] = useState<File[]>(location.state?.childFiles || []);
  // Derived from baseFile / childFiles: every PDF is exploded into its N pages as
  // PNG File objects. All downstream usage (preview URLs, FormData, sidebar,
  // apiResults indexing) works off these expanded arrays.
  const [expandedBaseFiles, setExpandedBaseFiles] = useState<File[]>([]);
  // Parallel string array for base page filenames. Kept separate so it survives
  // back-nav even when expandedBaseFiles is truncated to 1 entry (only the active
  // page is forwarded to PreviewPage, but the full name list must be preserved).
  const [expandedBaseFileNames, setExpandedBaseFileNames] = useState<string[]>(
    location.state?.expandedBaseFileNames ?? []
  );
  const [expandedChildFiles, setExpandedChildFiles] = useState<File[]>([]);
  const [isExpandingBase, setIsExpandingBase] = useState(false);
  const [isExpandingChild, setIsExpandingChild] = useState(false);
  const [isPdfTransitioning, setIsPdfTransitioning] = useState(false);
  const [originalBaseNames, setOriginalBaseNames] = useState<string[]>(
    location.state?.originalBaseNames ?? []
  );
  const [originalChildNames, setOriginalChildNames] = useState<string[]>(
    location.state?.originalChildNames ?? []
  );

  // Restored from location state when navigating back from the report page
  const [apiResults, setApiResults] = useState<any[]>(location.state?.apiResults || []);
  const [reportId, setReportId] = useState<string>(location.state?.reportId ?? '');
  const [lrfAnalysis, setLrfAnalysis] = useState<{ symbols: any[]; fields: any[] } | null>(
    location.state?.lrfAnalysis || null
  );
  const [analysisRun, setAnalysisRun] = useState<boolean>(
    !!(location.state?.apiResults?.length > 0 || location.state?.lrfAnalysis)
  );
  const [loading, setLoading] = useState(false);
  const { start: startStream, cancel: cancelStream, reset: resetStream, state: streamState } = useCompareStream({ apiBase: API_URL });

  // lrfOnly: fall back to single-label analysis only when no base file is available.
  // When a base file is uploaded alongside a proof request, run the full comparison
  // so barcode_summary.comparison is populated for barcode requirement validation.
  const lrfOnly = !!formData && baseFile.length === 0;

  // Expand base files: each PDF is exploded into N per-page PNG Files.
  // Images pass through unchanged.
  useEffect(() => {
    if (baseFile.length === 0) {
      setExpandedBaseFiles([]);
      if (!restoredBaseNamesRef.current) setOriginalBaseNames([]);
      setIsExpandingBase(false);
      return;
    }
    const hasAnyPdf = baseFile.some(isPdfFile);
    let cancelled = false;
    setIsExpandingBase(hasAnyPdf);

    (async () => {
      try {
        const expanded: File[] = [];
        const origNames: string[] = [];
        for (const file of baseFile) {
          if (isPdfFile(file)) {
            const pages = await pdfToImageFiles(file);
            expanded.push(...pages);
            pages.forEach(() => origNames.push(file.name));
          } else {
            expanded.push(file);
            origNames.push(file.name);
          }
        }
        if (!cancelled) {
          setExpandedBaseFiles(expanded);
          setExpandedBaseFileNames(expanded.map(f => f.name));
          if (restoredBaseNamesRef.current) {
            restoredBaseNamesRef.current = false; // keep restored names; next upload will overwrite
          } else {
            setOriginalBaseNames(origNames);
          }
          setIsExpandingBase(false);
          if (formData && hasAnyPdf) setIsPdfTransitioning(true);
        }
      } catch (e) {
        console.error("Failed to expand base PDF pages:", e);
        if (!cancelled) {
          setIsExpandingBase(false);
          toast.error("Failed to process base PDF pages.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [baseFile]);

  // Expand child files: each PDF is exploded into N per-page PNG Files.
  // Images pass through unchanged. The resulting array is what all downstream
  // usage (previews, FormData, sidebar) works off of.
  useEffect(() => {
    if (childFiles.length === 0) {
      setExpandedChildFiles([]);
      setOriginalChildNames([]);
      setIsExpandingChild(false);
      return;
    }
    const hasAnyPdf = childFiles.some(isPdfFile);
    let cancelled = false;
    setIsExpandingChild(hasAnyPdf);

    (async () => {
      try {
        const expanded: File[] = [];
        const origNames: string[] = [];
        for (const file of childFiles) {
          if (isPdfFile(file)) {
            const pages = await pdfToImageFiles(file);
            expanded.push(...pages);
            pages.forEach(() => origNames.push(file.name));
          } else {
            expanded.push(file);
            origNames.push(file.name);
          }
        }
        if (!cancelled) {
          setExpandedChildFiles(expanded);
          if (restoredChildNamesRef.current) {
            restoredChildNamesRef.current = false; // keep restored .pdf names; next upload will overwrite
          } else {
            setOriginalChildNames(origNames);
          }
          setIsExpandingChild(false);
          if (formData && hasAnyPdf) setIsPdfTransitioning(true);
        }
      } catch (e) {
        console.error("Failed to expand child PDF pages:", e);
        if (!cancelled) {
          setIsExpandingChild(false);
          toast.error("Failed to process PDF pages.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childFiles]);

  // Auto-run analysis for Scenario 3 (only when results are not already restored).
  // Guard: when a base file is present, wait for its PDF expansion to finish before
  // running — otherwise expandedBaseFiles is still [] and the count-match check fails.
  useEffect(() => {
    if (formData && expandedChildFiles.length > 0 && !analysisRun && !loading && streamState.status === 'idle') {
      if (!lrfOnly && isExpandingBase) return;
      handleRunAnalysis();
    }
  }, [formData, lrfOnly, isExpandingBase, expandedBaseFiles, expandedChildFiles, analysisRun, loading, streamState.status]);

  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(
    location.state?.selectedResultIndex ?? 0
  );
  // Always-current ref used inside stable setter callbacks so they never need
  // selectedResultIndex in their dependency arrays.
  const selectedResultIndexRef = useRef(selectedResultIndex);
  selectedResultIndexRef.current = selectedResultIndex;

  // ── Per-child state ─────────────────────────────────────────────────────────
  // Keyed by child index so deletions / adjustments on one label survive
  // switching to another label and back.  All three maps are initialised for
  // the child that was active when Index.tsx last navigated here.
  const initIdx = location.state?.selectedResultIndex ?? 0;

  const [adjustedBoxesByChild, setAdjustedBoxesByChild] = useState<Record<number, RequirementBox[] | null>>(() => {
    const fullMap = location.state?.allAdjustedBoxes as Record<string, RequirementBox[]> | undefined;
    if (fullMap && Object.keys(fullMap).length > 0) {
      return Object.fromEntries(Object.entries(fullMap).map(([k, v]) => [Number(k), v]));
    }
    // Do NOT pre-populate from location.state.requirementBoxes — that value was captured
    // for the originally-active page when navigating TO preview and must not be attributed
    // to initIdx (which may be a different page if the user switched pages in preview).
    // requirementBoxes is recomputed correctly from apiResults per selectedResultIndex.
    return { [initIdx]: null };
  });
  const [adjustedAnnotationsByChild, setAdjustedAnnotationsByChild] = useState<Record<number, Annotation[] | null>>(() => {
    const fullMap = location.state?.allAdjustedAnnotations as Record<string, Annotation[]> | undefined;
    if (fullMap && Object.keys(fullMap).length > 0) {
      return Object.fromEntries(Object.entries(fullMap).map(([k, v]) => [Number(k), v]));
    }
    // Do NOT pre-populate from location.state.annotations — that value was captured for
    // the originally-active page and must not be attributed to initIdx if the user
    // switched to a different page while in preview. currentAnnotations recomputes
    // correctly per page from apiResults so no pre-seeding is needed.
    return { [initIdx]: null };
  });
  const [deletedDiscrepancyIdsByChild, setDeletedDiscrepancyIdsByChild] = useState<Record<number, Set<number | string>>>(() => {
    const fullMap = location.state?.allDeletedDiscrepancyIdsByChild as Record<string, (number | string)[]> | undefined;
    if (fullMap && Object.keys(fullMap).length > 0) {
      return Object.fromEntries(Object.entries(fullMap).map(([k, v]) => [Number(k), new Set(v)]));
    }
    return { [initIdx]: new Set(location.state?.deletedDiscrepancyIds ?? []) };
  });

  // Derive current child's values — same variable names so nothing downstream changes.
  const adjustedBoxes        = adjustedBoxesByChild[selectedResultIndex]        ?? null;
  const adjustedAnnotations  = adjustedAnnotationsByChild[selectedResultIndex]  ?? null;
  const deletedDiscrepancyIds = deletedDiscrepancyIdsByChild[selectedResultIndex] ?? new Set<number | string>();

  // Stable wrapper setters — use the ref so they never go stale.
  const setAdjustedBoxes = useCallback(
    (valOrUpdater: RequirementBox[] | null | ((p: RequirementBox[] | null) => RequirementBox[] | null)) => {
      setAdjustedBoxesByChild(prev => {
        const idx = selectedResultIndexRef.current;
        const cur = prev[idx] ?? null;
        return { ...prev, [idx]: typeof valOrUpdater === 'function' ? valOrUpdater(cur) : valOrUpdater };
      });
    }, []
  );
  const setAdjustedAnnotations = useCallback(
    (val: Annotation[] | null) => {
      setAdjustedAnnotationsByChild(prev => ({ ...prev, [selectedResultIndexRef.current]: val }));
    }, []
  );
  const setDeletedDiscrepancyIds = useCallback(
    (valOrUpdater: Set<number | string> | ((p: Set<number | string>) => Set<number | string>)) => {
      setDeletedDiscrepancyIdsByChild(prev => {
        const idx = selectedResultIndexRef.current;
        const cur = prev[idx] ?? new Set<number | string>();
        return { ...prev, [idx]: typeof valOrUpdater === 'function' ? valOrUpdater(cur) : valOrUpdater };
      });
    }, []
  );
  const [basePreviewUrls, setBasePreviewUrls] = useState<string[]>(
    location.state?.expandedBasePreviewUrls || []
  );
  const [childPreviewUrls, setChildPreviewUrls] = useState<string[]>(
    location.state?.expandedChildPreviewUrls || []
  );

  // File objects may not survive location.state on some remount paths, but the
  // derived preview URLs (data URLs from PDF rendering, blob URLs otherwise) are
  // plain strings that persist. When URLs were restored from location.state,
  // hold them until a real expansion replaces them — otherwise the first run of
  // the rebuild effects (with empty File arrays) would clobber them to "".
  const restoredBaseUrlRef = useRef<boolean>(
    (location.state?.expandedBasePreviewUrls?.length ?? 0) > 0
  );
  const restoredChildUrlsRef = useRef<boolean>(
    (location.state?.expandedChildPreviewUrls?.length ?? 0) > 0
  );
  // Guard: don't overwrite restored originalBaseNames with a single-entry array
  // on back-nav remount (same reason as restoredBaseUrlRef — only 1 base file restored).
  const restoredBaseNamesRef = useRef<boolean>(
    (location.state?.originalBaseNames?.length ?? 0) > 0
  );
  // Guard: child files are PNG pages (not PDFs) after back-nav, so the expansion
  // effect would overwrite originalChildNames with ".png" names, breaking pdfPageName.
  // Preserve the restored ".pdf" names until the user actually uploads new files.
  const restoredChildNamesRef = useRef<boolean>(
    (location.state?.originalChildNames?.length ?? 0) > 0
  );

  // Converts an image File to a data URL using FileReader.
  // Data URLs are self-contained strings — unlike blob URLs they are never
  // revoked, so they survive navigation and can be safely passed through
  // location.state across multiple page hops (Index → Preview → Report).
  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Create preview URLs from uploaded files.
  // Both PDFs (via pdfToImage) and images (via FileReader) produce data URLs
  // so no blob URL cleanup is needed and the URLs survive unmount.
  useEffect(() => {
    if (expandedBaseFiles.length === 0) {
      if (!restoredBaseUrlRef.current) setBasePreviewUrls([]);
      return;
    }
    // When navigating back from Preview/Report, only the active pair's base file is
    // restored to state (Index only forwards one base file to PreviewPage).
    // expandedBaseFiles is therefore a single-entry array on remount, but
    // basePreviewUrls was correctly restored with the full multi-pair URL array.
    // Skip the rebuild so we don't overwrite the full array with a single URL.
    if (restoredBaseUrlRef.current) {
      restoredBaseUrlRef.current = false;
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const urls = await Promise.all(
          expandedBaseFiles.map((f) => isPdfFile(f) ? pdfToImage(f) : toDataUrl(f))
        );
        if (!cancelled) setBasePreviewUrls(urls);
      } catch (e) {
        console.error("Failed to build base previews:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [expandedBaseFiles]);

  useEffect(() => {
    if (expandedChildFiles.length === 0) {
      if (!restoredChildUrlsRef.current) setChildPreviewUrls([]);
      return;
    }
    // Real File objects supersede any restored URLs.
    restoredChildUrlsRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        const urls = await Promise.all(
          expandedChildFiles.map((f) =>
            isPdfFile(f) ? pdfToImage(f) : toDataUrl(f)
          )
        );
        if (!cancelled) setChildPreviewUrls(urls);
      } catch (e) {
        console.error("Failed to build child previews:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [expandedChildFiles]);

  // Per-child state is preserved — no reset needed when switching children.

  // Derived: URL for the base label of the currently selected pair
  const basePreviewUrl = basePreviewUrls[selectedResultIndex] || basePreviewUrls[0] || "";

  const handleRunAnalysis = async () => {
    if (expandedChildFiles.length === 0) {
      toast.error("Please upload the new version label.");
      return;
    }
    if (!lrfOnly && baseFile.length === 0) {
      toast.error("Please upload both base and child labels.");
      return;
    }
    if (!lrfOnly && expandedBaseFiles.length !== expandedChildFiles.length) {
      toast.error(
        `Base label count (${expandedBaseFiles.length}) must match child label count (${expandedChildFiles.length}).`
      );
      return;
    }

    // ── Upload limit guards (second gate — Dropzone enforces these at selection time) ──
    const LIMIT_FILE_BYTES = 20 * 1024 * 1024;
    const LIMIT_TOTAL_BYTES = 100 * 1024 * 1024;
    const LIMIT_PAGES = 50;

    if (lrfOnly) {
      if ((expandedChildFiles[0]?.size ?? 0) > LIMIT_FILE_BYTES) {
        toast.error("File exceeds the 20 MB per-file limit.");
        return;
      }
    } else {
      if (expandedChildFiles.length > LIMIT_PAGES) {
        toast.error(`New version has ${expandedChildFiles.length} pages. Maximum allowed is ${LIMIT_PAGES}.`);
        return;
      }
      if (expandedBaseFiles.length > LIMIT_PAGES) {
        toast.error(`Current version has ${expandedBaseFiles.length} pages. Maximum allowed is ${LIMIT_PAGES}.`);
        return;
      }
      const allFiles = [...expandedBaseFiles, ...expandedChildFiles];
      const oversized = allFiles.find(f => f.size > LIMIT_FILE_BYTES);
      if (oversized) {
        toast.error(`"${oversized.name}" exceeds the 20 MB per-file limit.`);
        return;
      }
      const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > LIMIT_TOTAL_BYTES) {
        toast.error(`Total upload size (${(totalSize / 1024 / 1024).toFixed(1)} MB) exceeds the 100 MB limit.`);
        return;
      }
    }

    setIsPdfTransitioning(false);
    setLoading(true);
    setAnalysisRun(false);


    try {
      if (lrfOnly) {
        // ── LRF-only mode: single-label analysis ────────────────────────────
        const data = new FormData();
        data.append("child_file", expandedChildFiles[0]);
        const response = await authFetch(`${API_URL}/api/analyze-label`, { method: "POST", body: data });
        if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);
        const rawData = await response.json();
        setLrfAnalysis(rawData);
        setApiResults([]);
        setSelectedResultIndex(0);
        setReportId(generateReportId());
        setAnalysisRun(true);
      } else {
        // ── Full diff mode: stream results via /api/compare/stream ──
        // Always send the frontend-expanded PNGs so there is a single source of
        // truth for page count, page order, and rendered images — both UI and
        // backend work from the same files.
        const data = new FormData();
        expandedBaseFiles.forEach(file => data.append("base_files", file));
        expandedChildFiles.forEach(file => data.append("child_files", file));
        if (submissionId) data.append("submission_id", submissionId);
        const userSku = formData?.metadata?.part_number?.trim();
        if (userSku) {
          data.append("skus", JSON.stringify(expandedChildFiles.map(() => userSku)));
        }
        startStream(data);
        return;
      }
    } catch (error) {
      console.error("Comparison error:", error);
      toast.error("Error running analysis. Please check your connection and try again.");
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const processStreamResults = useCallback((rawResults: any[]) => {
    const processedResults = rawResults.map((result: any, index: number) => {
      const apiDiscrepancies = result.discrepancies || {};
      const parsedItems: any[] = [];
      let idCounter = 1;
      let discrepancyIdx = 0;

      for (const status of ["Added", "Deleted", "Modified", "Repositioned"]) {
        if (apiDiscrepancies[status]) {
          apiDiscrepancies[status].forEach((item: any) => {
            let oldText: string | undefined, newText: string | undefined;
            let value = item.Value;
            if (status === "Modified" && typeof value === "string") {
              const match = value.match(/From:\s*'(.*?)'\s*➔\s*To:\s*'(.*?)'/);
              if (match) { oldText = match[1]; newText = match[2]; }
            }
            const ann = (result.annotations ?? []).find(
              (a: any) => a.discrepancy_id === discrepancyIdx
            );
            parsedItems.push({
              id: `api-d${index}-${idCounter++}`,
              discrepancy_id: discrepancyIdx,
              category: item.Category,
              status,
              value,
              oldText,
              newText,
              detail: item.detail ?? null,
              aiSummary: ann?.summary ?? null,
              confidence: ann?.confidence ?? null,
            });
            discrepancyIdx++;
          });
        }
      }

      return { ...result, parsedItems, yolo_review: result.yolo_review ?? [], child_fields: result.child_fields ?? {} };
    });

    setLrfAnalysis(null);
    setApiResults(processedResults);
    setAdjustedBoxesByChild({});
    setAdjustedAnnotationsByChild({});
    setDeletedDiscrepancyIdsByChild({});
    setSelectedResultIndex(0);
    setReportId(generateReportId());
    setAnalysisRun(true);
    resetStream();
  }, [resetStream]);

  // ── LRF requirement validation ──────────────────────────────────────────────
  // Cross-reference every LRF change against AI-found discrepancies.
  // In lrfOnly mode, the AI returns present symbols + fields and we check whether
  // each LRF requirement is satisfied by what was detected on the label.
  // Produces:
  //   validatedParsedItems — parsedItems enriched with isValid flag (null in lrfOnly)
  const allProcessedResults = useMemo<ProcessedApiResult[]>(() => {
    if (!analysisRun) return [];
    // Process ALL pages, not just the selected one
    return apiResults.map((result, index) => 
      processApiResult(result, formData, analysisRun, deletedDiscrepancyIdsByChild[index] ?? new Set(), lrfOnly, lrfAnalysis)
    );
  }, [apiResults, formData, analysisRun, deletedDiscrepancyIdsByChild, lrfOnly, lrfAnalysis]);

  const activeResult = allProcessedResults[selectedResultIndex];
  const validatedParsedItems = activeResult?.validatedParsedItems;
  const missingItems = activeResult?.missingItems ?? [];
  const satisfiedItems = activeResult?.satisfiedItems ?? [];
  const requirementBoxes = activeResult?.requirementBoxes ?? [];
  const unexpectedAnnotations = activeResult?.unexpectedAnnotations ?? [];

  // Called when user duplicates a requirement box in VisualDiffViewer
  const handleAddBox = useCallback((newBox: RequirementBox) => {
    setAdjustedBoxes(prev => {
      const current = prev ?? (requirementBoxes ?? []);
      // Avoid adding the same id twice (safety guard)
      if (current.some(b => b.id === newBox.id)) return current;
      return [...current, newBox];
    });
  }, [requirementBoxes]);

  const handleDeleteBox = useCallback((boxId: string) => {
    setAdjustedBoxes(prev => {
      const current = prev ?? (requirementBoxes ?? []);
      return current.filter(box => box.id !== boxId);
    });
  }, [requirementBoxes]);

  // Filter missingItems and satisfiedItems based on which requirement boxes are still visible.
  // When a user deletes a requirement box from VisualDiffViewer, the corresponding row in
  // the inspection details should also disappear.
  const currentRequirementBoxes = useMemo(
    () => adjustedBoxes !== null ? adjustedBoxes : (requirementBoxes ?? []),
    [adjustedBoxes, requirementBoxes]
  );

  const visibleRequirementBoxIds = useMemo(
    () => new Set(currentRequirementBoxes.map(b => b.id)),
    [currentRequirementBoxes]
  );

  const filteredMissingItems = useMemo(
    () => missingItems.filter(item => !visibleRequirementBoxIds.has(item.attrId)),
    [missingItems, visibleRequirementBoxIds]
  );

  const filteredSatisfiedItems = useMemo(
    () => satisfiedItems.filter(item => visibleRequirementBoxIds.has(item.attrId)),
    [satisfiedItems, visibleRequirementBoxIds]
  );

  const filteredValidatedParsedItems = useMemo(() => {
    if (!validatedParsedItems) return undefined;
    if (deletedDiscrepancyIds.size === 0) return validatedParsedItems;
    return validatedParsedItems.filter((item) =>
      item.discrepancy_id == null || !deletedDiscrepancyIds.has(item.discrepancy_id)
    );
  }, [validatedParsedItems, deletedDiscrepancyIds]);

  const filteredParsedItems = useMemo(() => {
    const parsedItems = apiResults[selectedResultIndex]?.parsedItems ?? [];
    if (deletedDiscrepancyIds.size === 0) return parsedItems;
    return parsedItems.filter((item) =>
      item.discrepancy_id == null || !deletedDiscrepancyIds.has(item.discrepancy_id)
    );
  }, [apiResults, selectedResultIndex, deletedDiscrepancyIds]);

  const [discardedUnexpectedIds] = useState<Set<string>>(
    new Set(location.state?.discardedUnexpectedIds ?? [])
  );
  const discardedAnnotationBoxIds = useMemo(
    () => [...discardedUnexpectedIds]
      .filter(id => id.startsWith('ai-'))
      .map(id => `annotation-${id.slice(3)}`),
    [discardedUnexpectedIds],
  );

  // ── Shared annotation array for both VisualDiffViewer and PreviewPage ───────
  // Single source of truth so analysis page and preview page always show the same
  // bounding boxes. Deduplication is category-aware: boxes of different categories
  // (e.g. Text vs Barcode/DataMatrix) are never merged even when spatially close.
  const currentAnnotations = useMemo<any[]>(() => {
    // If user has edited or deleted annotations, use the adjusted array directly
    if (adjustedAnnotations !== null) return adjustedAnnotations;
    return activeResult?.currentAnnotations ?? [];
  }, [adjustedAnnotations, activeResult]);

  const bboxDiscrepancyIds = useMemo(() => {
    return activeResult?.bboxDiscrepancyIds ?? new Set<number | string>();
  }, [activeResult]);

  return (
    <div className="h-screen bg-[#f8f9fa] flex flex-col overflow-hidden">

      <ReadingPdfModal isOpen={(isExpandingBase || isExpandingChild || isPdfTransitioning) && !loading} />
      <AnalysisProgressModal isOpen={loading} />

      {/* ── Streaming progress overlay (full diff mode) ── */}
      {streamState.status !== 'idle' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <CompareProgress
              state={streamState}
              onDone={(results) => processStreamResults(results)}
              onCancel={cancelStream}
            />
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-primary text-white px-6 py-0 flex items-center justify-between shadow-md sticky top-0 z-40" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-4 h-[52px]">
          <button
            onClick={() => formData
              ? navigate("/form-summary?flow=to-compare", { state: { formData, submissionId } })
              : navigate("/")}
            className="flex items-center gap-1 border-r border-white/20 pr-4 h-full text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelIX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">{formData ? "Proofing Analysis" : "Comparison Analysis"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {formData && (
            <div className="hidden md:block">
              <StepIndicator current={3} />
            </div>
          )}
          <ProfileDropdown />
        </div>
      </nav>

      {/* Secondary Metadata Bar (only when navigated via form) */}
      {formData && (
        <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between text-xs sticky top-[52px] z-30 shadow-sm">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[10px]">CR Number</span>
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.cr_number || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[10px]">SKU</span>
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.part_number || apiResults[selectedResultIndex]?.sku || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[10px]">Revision</span>
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.label_version || "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[11px]">Requested By</span>
            <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.requested_by || "Athmika"}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-row">

        <LabelSidebar
          baseFile={expandedBaseFiles[selectedResultIndex] ?? expandedBaseFiles[0] ?? null}
          basePreviewUrl={basePreviewUrl || null}
          baseFileName={pdfPageName(
            expandedBaseFileNames[selectedResultIndex] ?? expandedBaseFileNames[0],
            originalBaseNames[selectedResultIndex]     ?? originalBaseNames[0],
          )}
          childFiles={expandedChildFiles}
          childFileNames={expandedChildFiles.map((f, i) => pdfPageName(f.name, originalChildNames[i] ?? originalChildNames[0]))}
          childPreviewUrls={childPreviewUrls}
          apiResults={apiResults}
          selectedIndex={selectedResultIndex}
          onSelectChild={(i) => { setSelectedResultIndex(i); }}
          analysisRun={analysisRun}
        />

        <div className="flex-1 overflow-y-auto">

          <div className="px-6 py-6 space-y-6 pb-16 max-w-[1600px] mx-auto w-full">

            {/* ── Upload Section (Hidden in Scenario 3) ── */}
            {!formData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Dropzone
                    label="UPLOAD CURRENT VERSION LABELS (PDF / IMAGE)"
                    files={baseFile}
                    onFilesSelect={setBaseFile}
                    multiple={true}
                    alwaysShowUploadBox={true}
                  />
                  <Dropzone
                    label="UPLOAD NEW VERSION LABEL"
                    files={childFiles}
                    onFilesSelect={setChildFiles}
                    multiple={true}
                    alwaysShowUploadBox={true}
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleRunAnalysis}
                    disabled={loading || isExpandingBase || streamState.status === 'running'}
                    className="px-8 py-3 bg-primary text-white font-bold rounded shadow-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 tracking-wide text-sm"
                  >
                    {loading || streamState.status === 'running' ? "ANALYZING..." : isExpandingBase ? "PROCESSING PDF..." : "RUN COMPARATOR ANALYSIS"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Visual Diff Viewer ── */}
            <VisualDiffViewer
              baseImage={basePreviewUrl || undefined}
              childImage={childPreviewUrls[selectedResultIndex] || childPreviewUrls[0] || undefined}
              pageKey={selectedResultIndex}
              annotations={
                currentAnnotations.filter((_: any, i: number) => !discardedAnnotationBoxIds.includes(`annotation-${i}`))
              }
              requirementBoxes={currentRequirementBoxes}
              onBoxesChange={(boxes) => setAdjustedBoxes(boxes)}
              onAddBox={handleAddBox}
              onDeleteBox={handleDeleteBox}
              onAnnotationsChange={(newAnnotations) => {
                const current = adjustedAnnotations ?? currentAnnotations;
                if (newAnnotations.length < current.length) {
                  const newIds = new Set(newAnnotations.map((a: any) => a.discrepancy_id).filter((id: any) => id != null));
                  for (const ann of current) {
                    if (ann.discrepancy_id != null && !newIds.has(ann.discrepancy_id)) {
                      setDeletedDiscrepancyIds(prev => new Set([...prev, ann.discrepancy_id]));
                    }
                  }
                }
                setAdjustedAnnotations(newAnnotations);
              }}
            />

            {/* ── Inspection Summary + Details ── */}
            <DataTables
              formData={formData}
              discrepancies={
                // Only show items that have a localised bbox in the VisualDiffViewer
                // (matches the preview page behaviour where detail count = bbox count).
                analysisRun && apiResults.length > 0
                  ? (filteredValidatedParsedItems ?? filteredParsedItems ?? []).filter(
                    (item: any) => bboxDiscrepancyIds.has(item.discrepancy_id)
                  )
                  : undefined
              }
              missingItems={filteredMissingItems}
              satisfiedItems={filteredSatisfiedItems}
              yoloReview={apiResults[selectedResultIndex]?.yolo_review ?? []}
              childFields={apiResults[selectedResultIndex]?.child_fields ?? {}}
            />

          </div>
        </div>
      </main>

      {/* Footer action bar — sticky */}
      <div className="sticky bottom-0 bg-white border-t border-[#e2e8f0] px-8 py-2.5 flex items-center justify-between z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="font-mono text-xs text-slate-400 font-medium tracking-wide flex items-center gap-4">
          <span>Generated: {new Date().toISOString().split("T")[0]}</span>
          {formData && (
            <span>Ref: {formData?.metadata?.cr_number || "—"}</span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
          >
            BACK
          </button>
          <button
            onClick={() => navigate('/preview', {
              state: {
                scenario: formData ? 'C' : 'A',
                formData,
                submissionId,
                // Pass the fully processed arrays for ALL pages so Preview and Report pages have identical 
                // data to the Analysis page across the entire PDF, not just the active page.
                allProcessedParsedItems: allProcessedResults.map(r => r.validatedParsedItems ?? r.parsedItems ?? []),
                allProcessedAnnotations: allProcessedResults.map(r => r.currentAnnotations ?? []),
                allProcessedBboxIds: allProcessedResults.map(r => [...(r.bboxDiscrepancyIds ?? [])]),
                allProcessedRequirementBoxes: allProcessedResults.map(r => r.requirementBoxes ?? []),
                // Per-label SKU: backend resolves priority (user-entered > AI-extracted registration_number)
                allLabelSkus: apiResults.map(r => (r.sku as string | undefined) ?? ''),
                
                // Keep the active page specific ones for simple fallback if needed
                parsedItems: filteredValidatedParsedItems ?? (analysisRun && apiResults.length > 0 ? apiResults[selectedResultIndex]?.parsedItems : []) ?? [],
                missingItems: filteredMissingItems,
                satisfiedItems: filteredSatisfiedItems,
                annotations: currentAnnotations,
                deletedDiscrepancyIds: [...deletedDiscrepancyIds],
                reportId,
                // User-adjusted requirement box positions (proof-request mode only)
                requirementBoxes: (adjustedBoxes?.length ?? 0) > 0 ? adjustedBoxes : (requirementBoxes ?? []),
                // Full per-child maps — preserved across the round-trip so back-nav
                // restores deletions / adjustments for ALL pairs, not just the active one.
                allAdjustedAnnotations: Object.fromEntries(
                  Object.entries(adjustedAnnotationsByChild).filter(([, v]) => v !== null)
                ),
                allAdjustedBoxes: Object.fromEntries(
                  Object.entries(adjustedBoxesByChild).filter(([, v]) => v !== null)
                ),
                allDeletedDiscrepancyIdsByChild: Object.fromEntries(
                  Object.entries(deletedDiscrepancyIdsByChild).map(([k, v]) => [k, [...v]])
                ),
                // Barcode pipeline results for report summary + changes made
                barcode_summary: analysisRun && apiResults.length > 0 ? apiResults[selectedResultIndex]?.barcode_summary ?? null : null,
                // Pass as arrays — PreviewPage unpacks [0] for display, passes single File to ReportPage
                baseFile: expandedBaseFiles[selectedResultIndex] ? [expandedBaseFiles[selectedResultIndex]] : [],
                childFile: expandedChildFiles[selectedResultIndex] ? [expandedChildFiles[selectedResultIndex]] : [],
                originalBaseFiles: baseFile,
                originalChildFiles: childFiles,
                expandedBaseFiles: expandedBaseFiles,
                expandedChildFiles: expandedChildFiles,
                baseFileName: pdfPageName(
                  expandedBaseFileNames[selectedResultIndex] ?? expandedBaseFileNames[0],
                  originalBaseNames[selectedResultIndex] ?? originalBaseNames[0],
                ),
                childFileName: pdfPageName(
                  expandedChildFiles[selectedResultIndex]?.name,
                  originalChildNames[selectedResultIndex] ?? originalChildNames[0],
                ),
                // Stored so compare page can be fully restored when navigating back.
                // Preview URLs (strings) are the source of truth on remount because
                // File objects may not survive location.state across all remount paths.
                apiResults,
                lrfAnalysis,
                childFiles: expandedChildFiles,
                basePreviewUrl,
                expandedBasePreviewUrls: basePreviewUrls,
                expandedChildPreviewUrls: childPreviewUrls,
                expandedBaseFileNames,
                originalBaseNames,
                originalChildNames,
                analysisRun,
                selectedResultIndex,
                userAnnotations: restoredUserAnnotations,
              },
            })}
            className="flex items-center gap-2 bg-[#d51900] text-white px-8 py-3 text-[13px] font-bold uppercase tracking-widest hover:bg-[#b01300] transition-colors rounded-lg shadow-md"
          >
            <FileText className="w-4 h-4" />
            Review &amp; Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
