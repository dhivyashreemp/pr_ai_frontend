import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Download, RefreshCw, FileText, AlertCircle, Play, ScanLine, ArrowLeft } from "lucide-react";
import AnalysisProgressModal from "@/components/AnalysisProgressModal";
import { useLocation, useNavigate } from "react-router-dom";
import Dropzone from "@/components/Dropzone";
import VisualDiffViewer, { type RequirementBox, type Annotation } from "@/components/VisualDiffViewer";
import DataTables from "@/components/DataTables";
import LabelSidebar from "@/components/LabelSidebar";
import { pdfToImage, pdfToImageFiles, isPdfFile } from "@/lib/pdfToImage";
import ProfileDropdown from "@/components/ProfileDropdown";
import StepIndicator from "@/components/StepIndicator";
import { toast } from "sonner";
import { CATEGORIES } from "@/data/attributes";
import type { ProofRequestMissingItem } from "@/data/dummyData";

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
  const [expandedChildFiles, setExpandedChildFiles] = useState<File[]>([]);
  const [isExpandingBase, setIsExpandingBase] = useState(false);

  // Restored from location state when navigating back from the report page
  const [apiResults, setApiResults] = useState<any[]>(location.state?.apiResults || []);
  const [lrfAnalysis, setLrfAnalysis] = useState<{ symbols: any[]; fields: any[] } | null>(
    location.state?.lrfAnalysis || null
  );
  const [analysisRun, setAnalysisRun] = useState<boolean>(
    !!(location.state?.apiResults?.length > 0 || location.state?.lrfAnalysis)
  );
  const [loading, setLoading] = useState(false);

  // lrfOnly: fall back to single-label analysis only when no base file is available.
  // When a base file is uploaded alongside a proof request, run the full comparison
  // so barcode_summary.comparison is populated for barcode requirement validation.
  const lrfOnly = !!formData && baseFile.length === 0;

  // Expand base files: each PDF is exploded into N per-page PNG Files.
  // Images pass through unchanged.
  useEffect(() => {
    if (baseFile.length === 0) {
      setExpandedBaseFiles([]);
      setIsExpandingBase(false);
      return;
    }
    let cancelled = false;
    setIsExpandingBase(true);

    (async () => {
      try {
        const expanded: File[] = [];
        for (const file of baseFile) {
          if (isPdfFile(file)) {
            const pages = await pdfToImageFiles(file);
            expanded.push(...pages);
          } else {
            expanded.push(file);
          }
        }
        if (!cancelled) {
          setExpandedBaseFiles(expanded);
          setIsExpandingBase(false);
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
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const expanded: File[] = [];
        for (const file of childFiles) {
          if (isPdfFile(file)) {
            const pages = await pdfToImageFiles(file);
            expanded.push(...pages);
          } else {
            expanded.push(file);
          }
        }
        if (!cancelled) setExpandedChildFiles(expanded);
      } catch (e) {
        console.error("Failed to expand child PDF pages:", e);
        if (!cancelled) toast.error("Failed to process PDF pages.");
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
    if (formData && expandedChildFiles.length > 0 && !analysisRun && !loading) {
      if (!lrfOnly && isExpandingBase) return;
      handleRunAnalysis();
    }
  }, [formData, lrfOnly, isExpandingBase, expandedBaseFiles, expandedChildFiles, analysisRun, loading]);

  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(
    location.state?.selectedResultIndex ?? 0
  );
  // Tracks requirement box positions after user drags/resizes/duplicates them in VisualDiffViewer.
  // Restored from location.state when navigating back from PreviewPage so label edits survive.
  const [adjustedBoxes, setAdjustedBoxes] = useState<RequirementBox[]>(
    location.state?.requirementBoxes ?? []
  );
  // Restored from location.state when navigating back from PreviewPage so annotation label edits survive.
  const [adjustedAnnotations, setAdjustedAnnotations] = useState<Annotation[]>(
    location.state?.annotations ?? []
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
    restoredBaseUrlRef.current = false;
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

  // Skip the first run so boxes/annotations restored from navigation state (back from PreviewPage)
  // are not immediately wiped. Only reset when the user actually changes the selected child.
  const isFirstResultIndexRender = useRef(true);
  useEffect(() => {
    if (isFirstResultIndexRender.current) {
      isFirstResultIndexRender.current = false;
      return;
    }
    setAdjustedBoxes([]);
    setAdjustedAnnotations([]);
  }, [selectedResultIndex]);

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

    setLoading(true);
    setAnalysisRun(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    try {
      if (lrfOnly) {
        // ── LRF-only mode: single-label analysis ────────────────────────────
        const data = new FormData();
        data.append("child_file", expandedChildFiles[0]);
        const response = await fetch(`${API_URL}/api/analyze-label`, { method: "POST", body: data });
        if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);
        const rawData = await response.json();
        setLrfAnalysis(rawData);
        setApiResults([]);
        setSelectedResultIndex(0);
        setAnalysisRun(true);
      } else {
        // ── Full diff mode: N base labels paired positionally with N child labels ──
        const data = new FormData();
        expandedBaseFiles.forEach(file => data.append("base_files", file));
        expandedChildFiles.forEach(file => data.append("child_files", file));
        if (submissionId) data.append("submission_id", submissionId);
        const response = await fetch(`${API_URL}/api/compare`, { method: "POST", body: data });
        if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);
        const rawData = await response.json();

        const processedResults = rawData.results.map((result: any, index: number) => {
          const apiDiscrepancies = result.discrepancies || {};
          const parsedItems: any[] = [];
          let idCounter = 1;
          let discrepancyIdx = 0;

          for (const status of ["Added", "Deleted", "Modified", "Repositioned"]) {
            if (apiDiscrepancies[status]) {
              apiDiscrepancies[status].forEach((item: any) => {
                let oldText, newText;
                let value = item.Value;
                if (status === "Modified" && typeof value === "string") {
                  const match = value.match(/From:\s*'(.*?)'\s*➔\s*To:\s*'(.*?)'/);
                  if (match) { oldText = match[1]; newText = match[2]; }
                }
                // Find the annotation whose discrepancy_id matches this item's position
                const ann = (result.annotations ?? []).find(
                  (a: any) => a.discrepancy_id === discrepancyIdx
                );
                parsedItems.push({
                  id:         `api-d${index}-${idCounter++}`,
                  category:   item.Category,
                  status,
                  value,
                  oldText,
                  newText,
                  detail:     item.detail ?? null,
                  aiSummary:  ann?.summary ?? null,
                  confidence: ann?.confidence ?? null,
                });
                discrepancyIdx++;
              });
            }
          }

          return {
            ...result,
            parsedItems,
            yolo_review:  result.yolo_review  ?? [],
            child_fields: result.child_fields ?? {},
          };
        });

        setLrfAnalysis(null);
        setApiResults(processedResults);
        setSelectedResultIndex(0);
        setAdjustedAnnotations([]);
        setAnalysisRun(true);
      }
    } catch (error) {
      console.error("Comparison error:", error);
      toast.error("Error running analysis. Please check your connection and try again.");
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  // ── LRF requirement validation ──────────────────────────────────────────────
  // Cross-reference every LRF change against AI-found discrepancies.
  // In lrfOnly mode, the AI returns present symbols + fields and we check whether
  // each LRF requirement is satisfied by what was detected on the label.
  // Produces:
  //   validatedParsedItems — parsedItems enriched with isValid flag (null in lrfOnly)
  const { validatedParsedItems, missingItems, satisfiedItems, requirementBoxes, unexpectedAnnotations } = useMemo<{
    validatedParsedItems: any[] | undefined;
    missingItems: ProofRequestMissingItem[];
    requirementBoxes: RequirementBox[];
    satisfiedItems: ProofRequestMissingItem[];
    unexpectedAnnotations: any[];
  }>(() => {
    if (!formData || !analysisRun) {
      return { validatedParsedItems: undefined, missingItems: [], satisfiedItems: [], requirementBoxes: [], unexpectedAnnotations: [] };
    }

    // ── LRF-only mode ────────────────────────────────────────────────────────
    if (lrfOnly && lrfAnalysis) {
      const CATEGORY_LABEL_TO_AI: Record<string, "Text" | "Symbol" | "Barcode" | "Image"> = {
        "Text": "Text", "Symbols": "Symbol", "Symbol": "Symbol",
        "Barcodes": "Barcode", "Barcode": "Barcode",
        "DataMatrix": "Barcode", "Datamatrix": "Barcode",
        "Images": "Image", "Image": "Image",
      };
      const normCat = (label: string) => CATEGORY_LABEL_TO_AI[label] ?? label;
      const norm = (ct: string): string => {
        const MAP: Record<string, string> = {
          Modify: 'Modified', Add: 'Added', Delete: 'Deleted',
          Remove: 'Deleted',  Removed: 'Deleted',
        };
        return MAP[ct] ?? ct;
      };

      type Req = { attrId: string; label: string; category: string; changeType: string; expectedValue: string };
      const requirements: Req[] = [];
      for (const catId of Object.keys(CATEGORIES)) {
        const cat = CATEGORIES[catId as keyof typeof CATEGORIES];
        for (const group of cat.groups) {
          const allAttrs = [...group.attributes, ...(formData.customAttributes?.[group.id] ?? [])];
          for (const attr of allAttrs) {
            const change = formData.changes?.[attr.id];
            if (change?.changeType) {
              requirements.push({
                attrId: attr.id,
                label: attr.label,
                category: normCat(cat.label),
                changeType: norm(change.changeType),
                expectedValue: change.expectedValue ?? "",
              });
            }
          }
        }
      }

      // For lrfOnly, check if the symbol/field exists on the label
      const detectedSymbolNames = new Set(
        lrfAnalysis.symbols.map(s => (s.name || s.id || "").toLowerCase())
      );
      const detectedFieldMap: Record<string, string> = {};
      for (const f of lrfAnalysis.fields) {
        if (f.value && f.value !== "null") detectedFieldMap[f.id] = f.value;
      }

      const reqFoundIds = new Set<string>();
      for (const req of requirements) {
        if (req.category === "Symbol") {
          const labelLower = req.label.toLowerCase();
          const evLower = req.expectedValue.toLowerCase().trim();
          if (
            Array.from(detectedSymbolNames).some(n => n.includes(labelLower) || labelLower.includes(n)) ||
            (evLower && Array.from(detectedSymbolNames).some(n => n.includes(evLower)))
          ) {
            reqFoundIds.add(req.attrId);
          }
        } else if (req.category === "Text") {
          // Check if any text field satisfies this requirement.
          // IMPORTANT: when an expected value is given (ev), the field value MUST
          // contain it. Do NOT fall through to label/fid substring matching — that
          // would falsely satisfy "Rev B" because other_text "Rev A" contains the
          // substring "rev", making fvalLower.includes(al) true regardless of value.
          //
          // For the "rev" attribute specifically: revision codes (e.g. "REV. B") are
          // extracted into other_text by the AI, not into a dedicated field. To avoid
          // a short expected value like "b" falsely matching unrelated fields (e.g. an
          // address containing "34B Main St"), we require the revision pattern
          // "rev <expected>" to appear in other_text, then fall back to generic value
          // matching for all other fields.
          const ev = req.expectedValue.toLowerCase().trim();
          const al = req.label.toLowerCase();

          if (req.attrId === "rev" && ev) {
            // Check the dedicated rev field first (AI extracts just the letter, e.g. "A")
            const revVal = (detectedFieldMap["rev"] ?? "").toLowerCase().trim();
            if (revVal && (revVal === ev || revVal.includes(ev))) {
              reqFoundIds.add(req.attrId);
            } else {
              // Fallback: check other_text for "rev A" pattern
              const otherText = (detectedFieldMap["other_text"] ?? "").toLowerCase();
              if (otherText && new RegExp(`\\brev[.\\s]*${ev}\\b`).test(otherText)) {
                reqFoundIds.add(req.attrId);
              }
            }
          } else {
            for (const [fid, fval] of Object.entries(detectedFieldMap)) {
              const fvalLower = fval.toLowerCase();
              const satisfied = ev
                ? fvalLower.includes(ev)
                : fvalLower.includes(al) || al.includes(fid);
              if (satisfied) {
                reqFoundIds.add(req.attrId);
                break;
              }
            }
          }
        }
      }

      const missingItems: ProofRequestMissingItem[] = requirements
        .filter(req => !reqFoundIds.has(req.attrId))
        .map((req, i) => {
          let actualValue = "—";
          if (req.category === "Text") {
            actualValue = detectedFieldMap[req.attrId] || "—";
          }
          return {
            id: `missing-${i}`,
            category: req.category as ProofRequestMissingItem["category"],
            label: req.label,
            expectedChange: req.changeType,
            expectedValue: req.expectedValue || "—",
            actualValue,
          };
        });

      const satisfiedItems: ProofRequestMissingItem[] = requirements
        .filter(req => reqFoundIds.has(req.attrId))
        .map((req, i) => {
          let actualValue = "—";
          if (req.category === "Text") {
            actualValue = detectedFieldMap[req.attrId] || "—";
          }
          return {
            id: `satisfied-${i}`,
            category: req.category as ProofRequestMissingItem["category"],
            label: req.label,
            expectedChange: req.changeType,
            expectedValue: req.expectedValue || "—",
            actualValue,
          };
        });

      return { validatedParsedItems: undefined, missingItems, satisfiedItems, requirementBoxes: [], unexpectedAnnotations: [] };
    }

    // ── Full diff mode ───────────────────────────────────────────────────────
    if (apiResults.length === 0) {
      return { validatedParsedItems: undefined, missingItems: [], satisfiedItems: [], requirementBoxes: [], unexpectedAnnotations: [] };
    }
    const result = apiResults[selectedResultIndex];
    if (!result) return { validatedParsedItems: undefined, missingItems: [], satisfiedItems: [], requirementBoxes: [], unexpectedAnnotations: [] };

    const parsedItems: any[] = result.parsedItems ?? [];

    // Normalize present-tense form values → past-tense API values used throughout
    // matching logic (Pass 1–4) and barcode_summary change_type comparisons.
    const norm = (ct: string): string => {
      const MAP: Record<string, string> = {
        Modify:  'Modified',
        Add:     'Added',
        Delete:  'Deleted',
        Remove:  'Deleted',
        Removed: 'Deleted',
      };
      return MAP[ct] ?? ct;
    };

    // Normalize category labels: lcm_attributes.json uses plural display labels
    // ("Symbols", "Barcodes", "Images") but the AI backend emits singular forms
    // ("Symbol", "Barcode", "Image"). Centralising the mapping here means adding
    // a new category to the JSON never silently breaks requirement matching.
    const CATEGORY_LABEL_TO_AI: Record<string, "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image"> = {
      "Text":       "Text",
      "Symbols":    "Symbol",
      "Symbol":     "Symbol",
      "Barcodes":   "Barcode",
      "Barcode":    "Barcode",
      // DataMatrix has its own tab — keep it distinct for per-category summary counts
      "DataMatrix": "DataMatrix",
      "Datamatrix": "DataMatrix",
      "Images":     "Image",
      "Image":      "Image",
    };
    const normCat = (label: string): "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image" =>
      CATEGORY_LABEL_TO_AI[label] ?? (label as "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image");

    // Build flat requirement list from formData.changes + CATEGORIES
    type Req = { attrId: string; label: string; category: "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image"; changeType: string; expectedValue: string };
    const requirements: Req[] = [];
    for (const catId of Object.keys(CATEGORIES)) {
      const cat = CATEGORIES[catId as keyof typeof CATEGORIES];
      for (const group of cat.groups) {
        const allAttrs = [...group.attributes, ...(formData.customAttributes?.[group.id] ?? [])];
        for (const attr of allAttrs) {
          const change = formData.changes?.[attr.id];
          if (change?.changeType) {
            requirements.push({
              attrId: attr.id,
              label: attr.label,
              category: normCat(cat.label), // always singular, matching AI backend output
              changeType: norm(change.changeType),
              expectedValue: change.expectedValue ?? "",
            });
          }
        }
      }
    }

    // Value similarity check
    const valueMatches = (
      piValue: string,
      piNewText: string | undefined,
      piOldText: string | undefined,
      piStatus: string,
      attrLabel: string,
      expectedValue: string,
    ): boolean => {
      const pv = piValue.toLowerCase();
      const al = attrLabel.toLowerCase();
      const ev = expectedValue.toLowerCase().trim();

      if (piStatus === "Modified") {
        // For Modified items, only match if the new value equals the expected value.
        // Never match on the old value — that would falsely satisfy a requirement
        // when the change went the wrong way (e.g. Ireland→UK when Ireland was expected).
        if (!ev) return false;
        if (piNewText && piNewText.toLowerCase().includes(ev)) return true;
        // Fallback: expected value appears in the full "From: X → To: Y" string
        // but only after the arrow (i.e. in the "To" part)
        const arrowIdx = pv.indexOf("→");
        if (arrowIdx !== -1 && pv.slice(arrowIdx).includes(ev)) return true;
        return false;
      }

      // For Added / Deleted / Repositioned: match on field label or expected value
      if (pv.includes(al) || al.includes(pv)) return true;
      if (ev && pv.includes(ev)) return true;
      return false;
    };

    const matchedParsedIds = new Set<string>();
    const reqFoundIds = new Set<string>();
    // Tracks the actual value detected on the label for each requirement (attrId → value)
    const actualValueMap = new Map<string, string>();
    // Declared here so Pass 1/2 can use it for accurate Text actual values
    const childFields: Record<string, string> = result.child_fields || {};

    // Pass 1: strict label + value matching
    for (const req of requirements) {
      for (const pi of parsedItems) {
        if (pi.status !== req.changeType) continue;
        if (pi.category !== req.category) continue;
        if (valueMatches(pi.value, pi.newText, pi.oldText, pi.status, req.label, req.expectedValue)) {
          matchedParsedIds.add(pi.id);
          reqFoundIds.add(req.attrId);
          // For Text requirements prefer the dedicated extracted field value — it is
          // more precise than parsedItem text which may be a noisy diff string.
          const textActual = req.category === "Text" && childFields[req.attrId]
            ? childFields[req.attrId]
            : (pi.newText || pi.value);
          actualValueMap.set(req.attrId, textActual);
          break;
        }
      }
    }

    // Pass 2: for symbol/barcode/image with no expectedValue, retry with
    // label-only matching (valueMatches still required — no blind first-match).
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      if (!req.expectedValue && (req.category === "Symbol" || req.category === "Barcode" || req.category === "DataMatrix" || req.category === "Image")) {
        for (const pi of parsedItems) {
          if (pi.status !== req.changeType) continue;
          if (pi.category !== req.category) continue;
          if (matchedParsedIds.has(pi.id)) continue;
          // Still require the item's value to loosely match the attribute label
          if (valueMatches(pi.value, pi.newText, pi.oldText, pi.status, req.label, req.expectedValue)) {
            matchedParsedIds.add(pi.id);
            reqFoundIds.add(req.attrId);
            const textActual = req.category === "Text" && childFields[req.attrId]
              ? childFields[req.attrId]
              : (pi.newText || pi.value);
            actualValueMap.set(req.attrId, textActual);
            break;
          }
        }
      }
    }

    // Pass 3: for text-field requirements still not satisfied, verify the new
    // (edited) label's actual extracted value against the LRF requirement.
    // This handles the case where both labels already match the requested value
    // (0 diff detected) — proof reading should confirm the new label IS correct,
    // not just that a change occurred.
    //   Modified / Added → child label must have the expected value
    //   Deleted          → child label must NOT have the field
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      if (req.category !== "Text") continue;
      const ev = req.expectedValue.toLowerCase().trim();
      const fieldVal = childFields[req.attrId];
      if (req.changeType === "Modified" || req.changeType === "Added") {
        if (ev && fieldVal && fieldVal.toLowerCase().includes(ev)) {
          reqFoundIds.add(req.attrId);
          actualValueMap.set(req.attrId, fieldVal);
        }
      } else if (req.changeType === "Deleted") {
        if (!fieldVal) {
          reqFoundIds.add(req.attrId);
          actualValueMap.set(req.attrId, "—");
        }
      }
    }

    // Pass 4: barcode requirements — matched against barcode_summary.comparison.changes.
    // Barcodes are NOT in discrepancies/parsedItems; they go through a separate ZXing +
    // AI-text pipeline that returns barcode_summary alongside the main diff result.
    // "Modified" is satisfied when any barcode's decoded value OR printed text changed.
    // "Added" / "Removed" are satisfied when the comparison detected an addition/removal.
    // DataMatrix is included automatically (barcode_service handles it the same way).
    {
      const barcodeChanges: any[] = result.barcode_summary?.comparison?.changes ?? [];
      const detectedBcTypes = new Set(barcodeChanges.map((c: any) => c.change_type as string));

      for (const req of requirements) {
        if (reqFoundIds.has(req.attrId)) continue;
        if (req.category !== "Barcode" && req.category !== "DataMatrix") continue;
        const bcChangeType = req.changeType === "Deleted" ? "Removed" : req.changeType;

        // bc_1d_barcode / bc_datamatrix (barcode tab) and dm_* (datamatrix tab) narrow
        // the match to a specific barcode type. All other barcode attributes match any.
        const isDmAttr = req.attrId === "bc_datamatrix" || req.attrId.startsWith("dm_");
        const is1dAttr = req.attrId === "bc_1d_barcode";
        const relevantChanges = barcodeChanges.filter((c: any) => {
          if (!isDmAttr && !is1dAttr) return true;
          const bt = (c.barcode_type || "").toLowerCase();
          const isDm = bt.includes("datamatrix") || bt.includes("data_matrix") || bt.includes("matrix");
          return isDmAttr ? isDm : !isDm;
        });

        const matchingChange = relevantChanges.find((c: any) => c.change_type === bcChangeType);
        if (matchingChange) {
          reqFoundIds.add(req.attrId);
          const mc = matchingChange;
          const oldDec = mc.old_value   || "";
          const newDec = mc.new_value   || "";
          const oldPrt = mc.old_printed || "";
          const newPrt = mc.new_printed || "";
          // Always show all four combinations so the reviewer gets a complete picture.
          // Use "(none)" when HRI/printed text is absent (e.g. DataMatrix without separate HRI).
          const lines: string[] = [];
          lines.push(`Decoded: ${oldDec || "(none)"} → ${newDec || "(none)"}`);
          // Only show printed line when at least one side has actual HRI text.
          // DataMatrix barcodes typically have no separate printed text — skip silently.
          if (oldPrt || newPrt) lines.push(`Printed: ${oldPrt || "(none)"} → ${newPrt || "(none)"}`);

          actualValueMap.set(req.attrId, lines.join("\n"));
        }
      }
    }

    // Pass 5: Image requirements — matched against any detected Image discrepancy.
    // Image/background changes (colour, pattern, design) cannot be validated by a
    // text-value comparison. Any detected Image change with a matching change type
    // satisfies the form requirement.
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      if (req.category !== "Image") continue;
      for (const pi of parsedItems) {
        if (pi.category !== "Image") continue;
        if (pi.status !== req.changeType) continue;
        matchedParsedIds.add(pi.id);
        reqFoundIds.add(req.attrId);
        actualValueMap.set(req.attrId, pi.newText || pi.value || "Image change detected");
        break;
      }
    }

    // Pass 6: Image requirements — frontend-only last resort.
    // For full-diff mode (both images uploaded and compared by the backend),
    // satisfy any remaining Image requirements when the API has detected ANY
    // discrepancies. The form submission is authoritative: a user only submits
    // an Image requirement when they know a background/visual-design change was made.
    if (!lrfOnly && parsedItems.length > 0) {
      for (const req of requirements) {
        if (reqFoundIds.has(req.attrId)) continue;
        if (req.category !== "Image") continue;
        reqFoundIds.add(req.attrId);
        actualValueMap.set(req.attrId, req.expectedValue || "Image change confirmed");
      }
    }

    // Enrich parsedItems with isValid flag
    const validatedParsedItems = parsedItems.map(pi => ({
      ...pi,
      isValid: matchedParsedIds.has(pi.id),
    }));

    // Build missingItems — for each, try to surface what IS on the label
    const missingItems: ProofRequestMissingItem[] = requirements
      .filter(req => !reqFoundIds.has(req.attrId))
      .map((req, i) => {
        let actualValue = "—";
        if (req.category === "Text") {
          // Show whatever the child label actually has in that field
          actualValue = childFields[req.attrId] || "—";
        } else if (req.category === "Barcode" || req.category === "DataMatrix") {
          // No matching change detected — show the full 4-combination snapshot of what
          // is currently on each label so the reviewer can see the actual state.
          const baseBarcodes: any[]  = result.barcode_summary?.base?.barcode_elements  ?? [];
          const childBarcodes: any[] = result.barcode_summary?.child?.barcode_elements ?? [];
          const baseAiPrinted  = result.barcode_summary?.base?.ai_barcode_number  || "";
          const childAiPrinted = result.barcode_summary?.child?.ai_barcode_number || "";
          const lines: string[] = [];
          for (const b of baseBarcodes) {
            const dec = b.decoded_value      || "";
            const prt = b.printed_text_below || baseAiPrinted || "";
            lines.push(`Base decoded:  ${dec || "(none)"}`);
            lines.push(`Base printed:  ${prt || "(none)"}`);
          }
          for (const b of childBarcodes) {
            const dec = b.decoded_value      || "";
            const prt = b.printed_text_below || childAiPrinted || "";
            lines.push(`Child decoded: ${dec || "(none)"}`);
            lines.push(`Child printed: ${prt || "(none)"}`);
          }
          if (lines.length > 0) actualValue = lines.join("\n");
        }
        return {
          id: `missing-${i}`,
          category: req.category as ProofRequestMissingItem["category"],
          label: req.label,
          expectedChange: req.changeType,
          expectedValue: req.expectedValue || "—",
          actualValue,
        };
      });

    // Build satisfiedItems for requirements the AI DID find
    const satisfiedItems: ProofRequestMissingItem[] = requirements
      .filter(req => reqFoundIds.has(req.attrId))
      .map((req, i) => ({
        id: `satisfied-${i}`,
        category: req.category as ProofRequestMissingItem["category"],
        label: req.label,
        expectedChange: req.changeType,
        expectedValue: req.expectedValue || "—",
        actualValue: actualValueMap.get(req.attrId) || "—",
      }));

    // Build draggable requirement boxes for the Visual Diff Viewer.
    // Use the AI annotation that best matches each requirement as the initial
    // position so the user only needs a small adjustment, not a full drag.
    const DEFAULT_W = 0.24;
    const DEFAULT_H = 0.055;
    const GAP       = 0.010;

    const aiAnnotations: any[] = apiResults[selectedResultIndex]?.annotations ?? [];

    // Simple label-similarity match: split req label into words and look for
    // any word (>2 chars) appearing in the annotation label.
    const usedAnnIdx = new Set<number>();
    const findAnn = (label: string, changeType: string): any | null => {
      const words = label.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const ct    = changeType.toLowerCase();
      // First pass: label word match + change type match
      for (let i = 0; i < aiAnnotations.length; i++) {
        if (usedAnnIdx.has(i)) continue;
        const ann = aiAnnotations[i];
        const al  = ann.label?.toLowerCase() ?? "";
        const typeOk  = ann.change_type?.toLowerCase() === ct;
        const labelOk = words.some(w => al.includes(w));
        if (labelOk && typeOk) { usedAnnIdx.add(i); return ann; }
      }
      // Second pass: label only (looser match)
      for (let i = 0; i < aiAnnotations.length; i++) {
        if (usedAnnIdx.has(i)) continue;
        const ann = aiAnnotations[i];
        const al  = ann.label?.toLowerCase() ?? "";
        if (words.some(w => al.includes(w))) { usedAnnIdx.add(i); return ann; }
      }
      return null;
    };

    // Only satisfied requirements get a bounding box — missing ones have no
    // confirmed location on the label, so we don't place a box for them.
    const allReqs = [
      ...satisfiedItems.map(i => ({ ...i, satisfied: true as const })),
    ];

    let fallbackIdx = 0;
    const requirementBoxes: RequirementBox[] = allReqs.map(item => {
      const ann = findAnn(item.label, item.expectedChange);
      if (ann) {
        return {
          id:         item.id,
          label:      item.label,
          changeType: item.expectedChange,
          category:   item.category,
          satisfied:  item.satisfied,
          x:          ann.x,
          y:          ann.y,
          width:      ann.width  > 0 ? ann.width  : DEFAULT_W,
          height:     ann.height > 0 ? ann.height : DEFAULT_H,
        };
      }
      // No AI annotation match — stack on left edge as fallback
      const pos = {
        id:         item.id,
        label:      item.label,
        changeType: item.expectedChange,
        category:   item.category,
        satisfied:  item.satisfied,
        x:          0.01,
        y:          0.01 + fallbackIdx * (DEFAULT_H + GAP),
        width:      DEFAULT_W,
        height:     DEFAULT_H,
      };
      fallbackIdx++;
      return pos;
    });

    const unexpectedAnnotations = aiAnnotations.filter((_, idx) => !usedAnnIdx.has(idx));

    return { validatedParsedItems, missingItems, satisfiedItems, requirementBoxes, unexpectedAnnotations };
  }, [formData, analysisRun, lrfOnly, lrfAnalysis, apiResults, selectedResultIndex]);

  // Called when user duplicates a requirement box in VisualDiffViewer
  const handleAddBox = useCallback((newBox: RequirementBox) => {
    setAdjustedBoxes(prev => {
      // If adjustedBoxes is empty the user hasn't moved anything yet —
      // seed from the original requirementBoxes so positions are preserved
      const current = prev.length > 0 ? prev : (requirementBoxes ?? []);
      // Avoid adding the same id twice (safety guard)
      if (current.some(b => b.id === newBox.id)) return current;
      return [...current, newBox];
    });
  }, [requirementBoxes]);

  const handleDeleteBox = useCallback((boxId: string) => {
    setAdjustedBoxes(prev => {
      const current = prev.length > 0 ? prev : (requirementBoxes ?? []);
      return current.filter(box => box.id !== boxId);
    });
  }, [requirementBoxes]);

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
    if (adjustedAnnotations.length > 0) return adjustedAnnotations;
    if (!analysisRun || lrfOnly || apiResults.length === 0) return [];
    const result = apiResults[selectedResultIndex];
    if (!result) return [];

    const existingDiscrepancyIds = new Set(
      (result.annotations ?? [])
        .filter((a: any) => a.discrepancy_id != null)
        .map((a: any) => a.discrepancy_id)
    );

    // Defensive normalizer: converts 0-100 scale coords to 0-1 (no-op for already-0-1 values).
    const n = (v: number | undefined): number =>
      (v ?? 0) > 1 ? (v ?? 0) / 100 : (v ?? 0);

    // Helper: detect placeholder "full-image" bounding boxes (x≈0, y≈0, w≈1, h≈1).
    // The backend emits these when it knows about a change but can't localise it exactly
    // (e.g. the DataMatrix barcode when ZXing decodes it but doesn't return pixel coords).
    const isFullImageBox = (box: any) =>
      (box.x ?? 0) < 0.01 && (box.y ?? 0) < 0.01 &&
      (box.width ?? 1) > 0.99 && (box.height ?? 1) > 0.99;

    // diff_regions gives the actual visual diff areas on the child image.
    // Filter out the full-image placeholder to get real, localised regions.
    const usableDiffRegions = (result.diff_regions ?? []).filter(
      (r: any) => !isFullImageBox(r)
    );

    // When yolo_review is empty the backend has no pixel-accurate symbol detector running.
    // Symbol annotations in that case come from a rough visual estimate — mark them low confidence
    // so the overlay renders them with reduced opacity.
    const yoloAvailable = (result.yolo_review ?? []).length > 0;

    // Replace each placeholder annotation with the next usable diff_region.
    // Annotations without placeholder coords pass through unchanged.
    let drIdx = 0;
    const resolvedAnnotations = (result.annotations ?? [])
      .map((a: any) => {
        // Downgrade symbol confidence when YOLO data is absent
        const base = (!yoloAvailable && a.category === 'Symbol')
          ? { ...a, confidence: 'low' as const }
          : a;
        if (!isFullImageBox(base)) return base;
        if (drIdx < usableDiffRegions.length) {
          const r = usableDiffRegions[drIdx++];
          return { ...base, x: r.x, y: r.y, width: r.width, height: r.height };
        }
        return null; // No region available → drop this annotation
      })
      .filter(Boolean);

    const discrepancyBoxes: any[] = [];
    if (result.discrepancies) {
      let idx = 0;
      for (const status of ['Added', 'Deleted', 'Modified', 'Repositioned']) {
        const items = (result.discrepancies[status] ?? []) as any[];
        items.forEach((item: any) => {
          const bb = item.bounding_box;
          if (bb && bb.x != null && bb.y != null && !existingDiscrepancyIds.has(idx)) {
            discrepancyBoxes.push({
              label: item.Value ?? '',
              change_type: status as any,
              category: item.Category ?? '',
              x: n(bb.x), y: n(bb.y), width: n(bb.width), height: n(bb.height),
              confidence: (bb.confidence ?? 'medium') as any,
            });
          }
          idx++;
        });
      }
    }

    const yoloBoxes = (result.yolo_review ?? [])
      .filter((item: any) => item.x != null && item.y != null && item.width != null && item.height != null)
      .map((item: any) => ({
        label: item.name ?? item.label ?? '',
        change_type: (item.change_type ?? 'Modified') as any,
        category: item.yolo_class ?? '',
        x: n(item.x), y: n(item.y), width: n(item.width), height: n(item.height),
        confidence: 'low' as const,
      }));

    // Extract per-barcode bounding boxes from the barcode_summary pipeline.
    // The main result.annotations only carries a single "Barcode" annotation for the
    // 1D barcode region; the DataMatrix position lives in barcode_summary and must be
    // pulled out separately so the QR/DataMatrix symbol gets its own overlay box.
    const barcodeSummaryBoxes: any[] = [];
    const barcodeChanges: any[] = result.barcode_summary?.comparison?.changes ?? [];
    barcodeChanges.forEach((change: any) => {
      // Try all plausible field names the backend might use for the child-side bbox.
      const bb = change.child_bbox ?? change.child_bounding_box ?? change.bounding_box ?? change.bbox;
      if (!bb || bb.x == null) return;
      const btRaw = (change.barcode_type || '').toLowerCase();
      const isDm = btRaw.includes('matrix') || btRaw.includes('datamatrix') || btRaw.includes('qr');
      barcodeSummaryBoxes.push({
        label: change.new_value ?? change.old_value ?? (isDm ? 'DataMatrix' : 'Barcode'),
        change_type: (change.change_type ?? 'Modified') as any,
        category: isDm ? 'DataMatrix' : 'Barcode',
        x: n(bb.x), y: n(bb.y),
        width:  n(bb.width  ?? bb.w),
        height: n(bb.height ?? bb.h),
        confidence: 'medium' as const,
      });
    });

    // Also try individual barcode elements on the child label (ZXing positions).
    const childBarcodeElements: any[] = result.barcode_summary?.child?.barcode_elements ?? [];
    childBarcodeElements.forEach((elem: any) => {
      const bb = elem.bounding_box ?? elem.bbox ?? elem.rect;
      if (!bb || bb.x == null) return;
      const btRaw = (elem.barcode_type || '').toLowerCase();
      const isDm = btRaw.includes('matrix') || btRaw.includes('datamatrix') || btRaw.includes('qr');
      barcodeSummaryBoxes.push({
        label: elem.decoded_value ?? (isDm ? 'DataMatrix' : 'Barcode'),
        change_type: 'Modified' as any,
        category: isDm ? 'DataMatrix' : 'Barcode',
        x: n(bb.x), y: n(bb.y),
        width:  n(bb.width  ?? bb.w),
        height: n(bb.height ?? bb.h),
        confidence: 'low' as const,
      });
    });

    // Labels that should never be shown as bounding boxes.
    const hiddenLabels = new Set(['changed region']);

    const combined = [
      ...resolvedAnnotations,
      // Filter out placeholder full-image discrepancy boxes — the same change is already
      // captured by the resolved annotation above (with the correct diff_region position).
      ...discrepancyBoxes.filter((b: any) => !isFullImageBox(b)),
      ...yoloBoxes,
      ...barcodeSummaryBoxes,
    ].filter((b: any) => !hiddenLabels.has((b.label ?? '').toLowerCase().trim()));

    // Deduplicate by spatial proximity (center within 5%).
    // Category-aware: different-category boxes are never merged.
    const deduped: any[] = [];
    for (const box of combined) {
      const cx = (box.x ?? 0) + (box.width ?? 0) / 2;
      const cy = (box.y ?? 0) + (box.height ?? 0) / 2;
      const isDuplicate = deduped.some(existing => {
        if (box.category && existing.category && box.category !== existing.category) return false;
        const ex = (existing.x ?? 0) + (existing.width ?? 0) / 2;
        const ey = (existing.y ?? 0) + (existing.height ?? 0) / 2;
        return Math.abs(cx - ex) < 0.05 && Math.abs(cy - ey) < 0.05;
      });
      if (!isDuplicate) deduped.push(box);
    }

    return deduped;
  }, [adjustedAnnotations, analysisRun, lrfOnly, apiResults, selectedResultIndex]);

  return (
    <div className="h-screen bg-[#f8f9fa] flex flex-col overflow-hidden">

      <AnalysisProgressModal isOpen={loading} />

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
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.cr_number || "CR-2025-0042"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[10px]">SKU</span>
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.part_number || "08714729-MX"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[10px]">Revision</span>
              <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.label_version || "REV-D"}</span>
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
          childFiles={expandedChildFiles}
          childPreviewUrls={childPreviewUrls}
          apiResults={apiResults}
          selectedIndex={selectedResultIndex}
          onSelectChild={(i) => { setSelectedResultIndex(i); setAdjustedAnnotations([]); }}
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
                  disabled={loading || isExpandingBase}
                  className="px-8 py-3 bg-primary text-white font-bold rounded shadow-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 tracking-wide text-sm"
                >
                  {loading ? "ANALYZING..." : isExpandingBase ? "PROCESSING PDF..." : "RUN COMPARATOR ANALYSIS"}
                </button>
              </div>
            </div>
          )}

          {/* ── Visual Diff Viewer ── */}
          <VisualDiffViewer
            baseImage={basePreviewUrl || undefined}
            childImage={childPreviewUrls[selectedResultIndex] || childPreviewUrls[0] || undefined}
            annotations={
              currentAnnotations.filter((_: any, i: number) => !discardedAnnotationBoxIds.includes(`annotation-${i}`))
            }
            requirementBoxes={(adjustedBoxes.length > 0 ? adjustedBoxes : (requirementBoxes ?? [])).map(
              ({ satisfied: _, ...rest }) => rest as RequirementBox
            )}
            onBoxesChange={(boxes) => setAdjustedBoxes(boxes)}
            onAddBox={handleAddBox}
            onDeleteBox={handleDeleteBox}
            onAnnotationsChange={setAdjustedAnnotations}
          />

          {/* ── Inspection Summary + Details ── */}
          <DataTables
            formData={formData}
            discrepancies={
              // In form mode: pass validatedParsedItems so the dashboard can
              // separate Expected vs Unexpected changes.
              // In direct comparison mode: show all AI detections.
              analysisRun && apiResults.length > 0
                ? (validatedParsedItems ?? apiResults[selectedResultIndex]?.parsedItems ?? [])
                : undefined
            }
            missingItems={missingItems}
            satisfiedItems={satisfiedItems}
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
            <span>Ref: {formData?.metadata?.cr_number || "CR-2025-0042"}</span>
          )}
        </div>
        <button
          onClick={() => navigate('/preview', {
          state: {
            scenario: formData ? 'C' : 'A',
            formData,
            submissionId,
            // Pass ALL validated items (valid + invalid).
            // ReportPage splits them: isValid===true → Expected Changes, isValid===false → Unexpected Changes.
            parsedItems: validatedParsedItems ?? (analysisRun && apiResults.length > 0 ? apiResults[selectedResultIndex]?.parsedItems : []) ?? [],
            missingItems,
            satisfiedItems,
            annotations: currentAnnotations,
            // User-adjusted requirement box positions (proof-request mode only)
            requirementBoxes: adjustedBoxes.length > 0 ? adjustedBoxes : (requirementBoxes ?? []),
            // Barcode pipeline results for report summary + changes made
            barcode_summary: analysisRun && apiResults.length > 0 ? apiResults[selectedResultIndex]?.barcode_summary ?? null : null,
            // Pass as arrays — PreviewPage unpacks [0] for display, passes single File to ReportPage
            baseFile:  expandedBaseFiles[selectedResultIndex] ? [expandedBaseFiles[selectedResultIndex]] : [],
            childFile: expandedChildFiles[selectedResultIndex] ? [expandedChildFiles[selectedResultIndex]] : [],
            baseFileName: expandedBaseFiles[selectedResultIndex]?.name ?? '',
            childFileName: expandedChildFiles[selectedResultIndex]?.name ?? '',
            // Stored so compare page can be fully restored when navigating back.
            // Preview URLs (strings) are the source of truth on remount because
            // File objects may not survive location.state across all remount paths.
            apiResults,
            lrfAnalysis,
            childFiles: expandedChildFiles,
            basePreviewUrl,
            expandedBasePreviewUrls: basePreviewUrls,
            expandedChildPreviewUrls: childPreviewUrls,
            expandedBaseFileNames: expandedBaseFiles.map(f => f.name),
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
  );
};

export default Index;
