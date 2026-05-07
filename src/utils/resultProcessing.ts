import { CATEGORIES } from "@/data/attributes";
import type { ProofRequestMissingItem } from "@/data/dummyData";
import type { RequirementBox } from "@/components/VisualDiffViewer";

export interface ProcessedApiResult {
  validatedParsedItems: any[] | undefined;
  missingItems: ProofRequestMissingItem[];
  satisfiedItems: ProofRequestMissingItem[];
  requirementBoxes: RequirementBox[];
  unexpectedAnnotations: any[];
  currentAnnotations: any[];
  bboxDiscrepancyIds: Set<number | string>;
  parsedItems: any[];
}

// Normalize present-tense form values → past-tense API values used throughout
// matching logic (Pass 1–4) and barcode_summary change_type comparisons.
const norm = (ct: string): string => {
  const MAP: Record<string, string> = {
    Modify: 'Modified',
    Add: 'Added',
    Delete: 'Deleted',
    Remove: 'Deleted',
    Removed: 'Deleted',
  };
  return MAP[ct] ?? ct;
};

// Normalize category labels: lcm_attributes.json uses plural display labels
// ("Symbols", "Barcodes", "Images") but the AI backend emits singular forms
// ("Symbol", "Barcode", "Image").
const CATEGORY_LABEL_TO_AI: Record<string, "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image"> = {
  "Text": "Text",
  "Symbols": "Symbol",
  "Symbol": "Symbol",
  "Barcodes": "Barcode",
  "Barcode": "Barcode",
  "DataMatrix": "DataMatrix",
  "Datamatrix": "DataMatrix",
  "Images": "Image",
  "Image": "Image",
};

const normCat = (label: string): "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image" =>
  CATEGORY_LABEL_TO_AI[label] ?? (label as "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image");

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
    if (!ev) return false;
    if (piNewText && piNewText.toLowerCase().includes(ev)) return true;
    const arrowIdx = pv.indexOf("→");
    if (arrowIdx !== -1 && pv.slice(arrowIdx).includes(ev)) return true;
    return false;
  }

  if (pv.includes(al)) return true;
  if (ev && pv.includes(ev)) return true;
  return false;
};

export function processApiResult(
  result: any,
  formData: any | null,
  analysisRun: boolean,
  deletedDiscrepancyIds: Set<number | string>,
  lrfOnly: boolean,
  lrfAnalysis?: any
): ProcessedApiResult {
  if (!result || (!analysisRun && !formData)) {
    return {
      validatedParsedItems: undefined,
      missingItems: [],
      satisfiedItems: [],
      requirementBoxes: [],
      unexpectedAnnotations: [],
      currentAnnotations: [],
      bboxDiscrepancyIds: new Set(),
      parsedItems: [],
    };
  }

  // 1. Build requirement rules
  type Req = { attrId: string; label: string; category: "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image"; changeType: string; expectedValue: string };
  const requirements: Req[] = [];
  if (formData && !lrfOnly) {
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
  }

  // 2. Extract AI Annotations and Discrepancy Boxes
  const existingDiscrepancyIds = new Set(
    (result.annotations ?? [])
      .filter((a: any) => a.discrepancy_id != null)
      .map((a: any) => a.discrepancy_id)
  );

  const n = (v: number | undefined): number => ((v ?? 0) > 1 ? (v ?? 0) / 100 : (v ?? 0));
  const isFullImageBox = (box: any) => (box.x ?? 0) < 0.01 && (box.y ?? 0) < 0.01 && (box.width ?? 1) > 0.99 && (box.height ?? 1) > 0.99;

  const usableDiffRegions = (result.diff_regions ?? []).filter((r: any) => !isFullImageBox(r));
  const yoloAvailable = (result.yolo_review ?? []).length > 0;

  let drIdx = 0;
  const resolvedAnnotations = (result.annotations ?? [])
    .map((a: any) => {
      const base = (!yoloAvailable && a.category === 'Symbol') ? { ...a, confidence: 'low' as const } : a;
      if (!isFullImageBox(base)) return base;
      if (drIdx < usableDiffRegions.length) {
        const r = usableDiffRegions[drIdx++];
        return { ...base, x: r.x, y: r.y, width: r.width, height: r.height };
      }
      return null;
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
            discrepancy_id: idx,
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

  const barcodeSummaryBoxes: any[] = [];
  const barcodeChanges: any[] = result.barcode_summary?.comparison?.changes ?? [];
  barcodeChanges.forEach((change: any) => {
    const bb = change.child_bbox ?? change.child_bounding_box ?? change.bounding_box ?? change.bbox;
    if (!bb || bb.x == null) return;
    const btRaw = (change.barcode_type || '').toLowerCase();
    const isDm = btRaw.includes('matrix') || btRaw.includes('datamatrix') || btRaw.includes('qr');
    barcodeSummaryBoxes.push({
      label: change.new_value ?? change.old_value ?? (isDm ? 'DataMatrix' : 'Barcode'),
      change_type: (change.change_type ?? 'Modified') as any,
      category: isDm ? 'DataMatrix' : 'Barcode',
      x: n(bb.x), y: n(bb.y), width: n(bb.width ?? bb.w), height: n(bb.height ?? bb.h),
      confidence: 'medium' as const,
    });
  });

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
      x: n(bb.x), y: n(bb.y), width: n(bb.width ?? bb.w), height: n(bb.height ?? bb.h),
      confidence: 'low' as const,
    });
  });

  const hiddenLabels = new Set(['changed region']);
  const combined = [
    ...resolvedAnnotations,
    ...discrepancyBoxes.filter((b: any) => !isFullImageBox(b)),
    ...yoloBoxes,
    ...barcodeSummaryBoxes,
  ].filter((b: any) => !hiddenLabels.has((b.label ?? '').toLowerCase().trim()));

  const lb = result.label_bounds as { x: number; y: number; w: number; h: number } | undefined;
  const transformed = lb ? combined.map(box => ({
    ...box,
    x: lb.x + (box.x ?? 0) * lb.w,
    y: lb.y + (box.y ?? 0) * lb.h,
    width: (box.width ?? 0) * lb.w,
    height: (box.height ?? 0) * lb.h,
  })) : combined;

  const deduped: any[] = [];
  for (const box of transformed) {
    const cx = (box.x ?? 0) + (box.width ?? 0) / 2;
    const cy = (box.y ?? 0) + (box.height ?? 0) / 2;
    const existingIdx = deduped.findIndex(existing => {
      const ex = (existing.x ?? 0) + (existing.width ?? 0) / 2;
      const ey = (existing.y ?? 0) + (existing.height ?? 0) / 2;
      
      // 1. Center check: if centers are extremely close (< 2%), they are duplicates
      if (Math.abs(cx - ex) < 0.02 && Math.abs(cy - ey) < 0.02) {
        return true;
      }

      // 2. Intersection Over Minimum Area (IOM) check
      // For overlapping bounding boxes from different AI parsers (e.g., Code 128 vs GS1 vs Text)
      const bx1 = box.x ?? 0;
      const by1 = box.y ?? 0;
      const bx2 = bx1 + (box.width ?? 0);
      const by2 = by1 + (box.height ?? 0);
      const areaB = (box.width ?? 0) * (box.height ?? 0);

      const ex1 = existing.x ?? 0;
      const ey1 = existing.y ?? 0;
      const ex2 = ex1 + (existing.width ?? 0);
      const ey2 = ey1 + (existing.height ?? 0);
      const areaE = (existing.width ?? 0) * (existing.height ?? 0);

      const ix1 = Math.max(bx1, ex1);
      const iy1 = Math.max(by1, ey1);
      const ix2 = Math.min(bx2, ex2);
      const iy2 = Math.min(by2, ey2);

      if (ix2 > ix1 && iy2 > iy1) {
        const intersection = (ix2 - ix1) * (iy2 - iy1);
        const minArea = Math.min(areaB, areaE);
        // If the intersection covers more than 60% of the smaller box, merge them!
        if (minArea > 0 && (intersection / minArea) > 0.6) {
          return true;
        }
      }

      return false;
    });
    if (existingIdx === -1) {
      deduped.push(box);
    } else if (box.discrepancy_id != null && deduped[existingIdx].discrepancy_id == null) {
      deduped[existingIdx] = { ...deduped[existingIdx], discrepancy_id: box.discrepancy_id };
    }
  }

  const currentAnnotations = deduped.filter(
    (b: any) => b.discrepancy_id == null || !deletedDiscrepancyIds.has(b.discrepancy_id)
  );

  const bboxDiscrepancyIds = new Set<number | string>(
    currentAnnotations.filter((a: any) => a.discrepancy_id != null).map((a: any) => a.discrepancy_id)
  );

  // 3. Process requirements and parsed items
  const parsedItems: any[] = result.parsedItems ?? [];
  const matchedParsedIds = new Set<string>();
  const reqFoundIds = new Set<string>();
  const reqToDiscrepancyId = new Map<string, any>();
  const actualValueMap = new Map<string, string>();
  const childFields: Record<string, string> = result.child_fields || {};

  if (formData && !lrfOnly) {
    // Pass 1
    for (const req of requirements) {
      for (const pi of parsedItems) {
        if (pi.status !== req.changeType) continue;
        if (pi.category !== req.category) continue;
        if (valueMatches(pi.value, pi.newText, pi.oldText, pi.status, req.label, req.expectedValue)) {
          matchedParsedIds.add(pi.id);
          reqFoundIds.add(req.attrId);
          if (pi.discrepancy_id != null) reqToDiscrepancyId.set(req.attrId, pi.discrepancy_id);
          actualValueMap.set(req.attrId, req.category === "Text" && childFields[req.attrId] ? childFields[req.attrId] : (pi.newText || pi.value));
          break;
        }
      }
    }

    // Pass 2
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      if (!req.expectedValue && (req.category === "Symbol" || req.category === "Barcode" || req.category === "DataMatrix" || req.category === "Image")) {
        for (const pi of parsedItems) {
          if (pi.status !== req.changeType) continue;
          if (pi.category !== req.category) continue;
          if (matchedParsedIds.has(pi.id)) continue;
          if (valueMatches(pi.value, pi.newText, pi.oldText, pi.status, req.label, req.expectedValue)) {
            matchedParsedIds.add(pi.id);
            reqFoundIds.add(req.attrId);
            if (pi.discrepancy_id != null) reqToDiscrepancyId.set(req.attrId, pi.discrepancy_id);
            actualValueMap.set(req.attrId, req.category === "Text" && childFields[req.attrId] ? childFields[req.attrId] : (pi.newText || pi.value));
            break;
          }
        }
      }
    }

    // Pass 3
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

    // Pass 4
    {
      const barcodeChanges: any[] = result.barcode_summary?.comparison?.changes ?? [];
      for (const req of requirements) {
        if (reqFoundIds.has(req.attrId)) continue;
        if (req.category !== "Barcode" && req.category !== "DataMatrix") continue;
        const bcChangeType = req.changeType === "Deleted" ? "Removed" : req.changeType;
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
          const oldDec = mc.old_value || "";
          const newDec = mc.new_value || "";
          const oldPrt = mc.old_printed || "";
          const newPrt = mc.new_printed || "";
          const lines: string[] = [];
          lines.push(`Decoded: ${oldDec || "(none)"} → ${newDec || "(none)"}`);
          if (oldPrt || newPrt) lines.push(`Printed: ${oldPrt || "(none)"} → ${newPrt || "(none)"}`);
          actualValueMap.set(req.attrId, lines.join("\n"));
        }
      }
    }

    // Pass 5 & 6
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      if (req.category !== "Image") continue;
      let matched = false;
      for (const pi of parsedItems) {
        if (pi.category === "Image" && pi.status === req.changeType) {
          matchedParsedIds.add(pi.id);
          reqFoundIds.add(req.attrId);
          actualValueMap.set(req.attrId, pi.newText || pi.value || "Image change detected");
          matched = true;
          break;
        }
      }
      if (!matched && parsedItems.length > 0) {
        reqFoundIds.add(req.attrId);
        actualValueMap.set(req.attrId, req.expectedValue || "Image change confirmed");
      }
    }
  }

  // Determine LRF-only satisfaction
  if (lrfOnly && lrfAnalysis && Array.isArray(lrfAnalysis.requirements)) {
    const detectedFieldMap: Record<string, string> = {
      ...(lrfAnalysis.base_fields || {}),
      ...(lrfAnalysis.child_fields || {})
    };
    for (const req of requirements) {
      if (reqFoundIds.has(req.attrId)) continue;
      const ev = req.expectedValue.toLowerCase().trim();
      const al = req.label.toLowerCase();
      
      const foundInAnalysis = lrfAnalysis.requirements.find((r: any) => 
        r.requirement?.toLowerCase() === ev || 
        r.requirement?.toLowerCase() === al || 
        r.description?.toLowerCase().includes(ev) ||
        r.description?.toLowerCase().includes(al)
      );
      
      if (foundInAnalysis && (foundInAnalysis.status === "Satisfied" || foundInAnalysis.met === true)) {
        reqFoundIds.add(req.attrId);
      } else {
        for (const [fid, fval] of Object.entries(detectedFieldMap)) {
          const fvalLower = fval.toLowerCase();
          const satisfied = ev ? fvalLower.includes(ev) : fvalLower.includes(al) || al.includes(fid);
          if (satisfied) {
            reqFoundIds.add(req.attrId);
            break;
          }
        }
      }
    }
  }

  // 4. Enrich and Build output
  const validatedParsedItems = formData ? parsedItems.map(pi => ({
    ...pi,
    isValid: matchedParsedIds.has(pi.id),
  })) : undefined;

  let missingItems: ProofRequestMissingItem[] = [];
  let satisfiedItems: ProofRequestMissingItem[] = [];
  let requirementBoxes: RequirementBox[] = [];
  let unexpectedAnnotations: any[] = [];

  if (formData) {
    missingItems = requirements.filter(req => !reqFoundIds.has(req.attrId)).map((req, i) => {
      let actualValue = "—";
      if (req.category === "Text") {
        actualValue = childFields[req.attrId] || "—";
      } else if (req.category === "Barcode" || req.category === "DataMatrix") {
        const baseBarcodes: any[] = result.barcode_summary?.base?.barcode_elements ?? [];
        const childBarcodes: any[] = result.barcode_summary?.child?.barcode_elements ?? [];
        const baseAiPrinted = result.barcode_summary?.base?.ai_barcode_number || "";
        const childAiPrinted = result.barcode_summary?.child?.ai_barcode_number || "";
        const lines: string[] = [];
        for (const b of baseBarcodes) {
          const dec = b.decoded_value || "";
          const prt = b.printed_text_below || baseAiPrinted || "";
          lines.push(`Base decoded:  ${dec || "(none)"}`);
          lines.push(`Base printed:  ${prt || "(none)"}`);
        }
        for (const b of childBarcodes) {
          const dec = b.decoded_value || "";
          const prt = b.printed_text_below || childAiPrinted || "";
          lines.push(`Child decoded: ${dec || "(none)"}`);
          lines.push(`Child printed: ${prt || childAiPrinted || "(none)"}`);
        }
        if (lines.length > 0) actualValue = lines.join("\n");
      }
      return {
        id: `missing-${i}`,
        attrId: req.attrId,
        category: req.category as ProofRequestMissingItem["category"],
        label: req.label,
        expectedChange: req.changeType,
        expectedValue: req.expectedValue || "—",
        actualValue,
      };
    });

    satisfiedItems = requirements.filter(req => reqFoundIds.has(req.attrId)).map((req, i) => ({
      id: `satisfied-${i}`,
      attrId: req.attrId,
      category: req.category as ProofRequestMissingItem["category"],
      label: req.label,
      expectedChange: req.changeType,
      expectedValue: req.expectedValue || "—",
      actualValue: actualValueMap.get(req.attrId) || "—",
    }));

    if (!lrfOnly) {
      const DEFAULT_W = 0.24;
      const DEFAULT_H = 0.055;
      const GAP = 0.010;

      const aiAnnotations: any[] = result.annotations ?? [];
      const localDiscrepancyBoxes: any[] = [];
      if (result.discrepancies) {
        let idx = 0;
        for (const status of ['Added', 'Deleted', 'Modified', 'Repositioned']) {
          const items: any[] = (result.discrepancies[status] ?? []);
          items.forEach((item: any) => {
            const bb = item.bounding_box;
            if (bb && bb.x != null && bb.y != null) {
              localDiscrepancyBoxes.push({
                label: item.Value ?? '',
                change_type: status,
                category: item.Category ?? '',
                x: n(bb.x), y: n(bb.y), width: n(bb.width), height: n(bb.height),
                discrepancy_id: idx,
              });
            }
            idx++;
          });
        }
      }

      const allAnnotationSources: any[] = [...aiAnnotations, ...localDiscrepancyBoxes];
      const usedAnnIdx = new Set<number>();
      const findAnn = (label: string, changeType: string, discrepancyId?: any): any | null => {
        if (discrepancyId != null) {
          for (let i = 0; i < allAnnotationSources.length; i++) {
            if (usedAnnIdx.has(i)) continue;
            if (allAnnotationSources[i].discrepancy_id === discrepancyId) {
              usedAnnIdx.add(i);
              return allAnnotationSources[i];
            }
          }
        }
        const words = label.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const ct = changeType.toLowerCase();
        for (let i = 0; i < allAnnotationSources.length; i++) {
          if (usedAnnIdx.has(i)) continue;
          const ann = allAnnotationSources[i];
          const al = ann.label?.toLowerCase() ?? "";
          if (words.length > 0 && words.every(w => al.includes(w)) && ann.change_type?.toLowerCase() === ct) { usedAnnIdx.add(i); return ann; }
        }
        for (let i = 0; i < allAnnotationSources.length; i++) {
          if (usedAnnIdx.has(i)) continue;
          const ann = allAnnotationSources[i];
          if (words.length > 0 && words.every(w => (ann.label?.toLowerCase() ?? "").includes(w))) { usedAnnIdx.add(i); return ann; }
        }
        return null;
      };

      const allReqs = [...satisfiedItems.map(i => ({ ...i, satisfied: true as const }))];
      let fallbackIdx = 0;
      requirementBoxes = allReqs.map(item => {
        const ann = findAnn(item.label, item.expectedChange, reqToDiscrepancyId.get(item.attrId));
        if (ann) {
          const nw = n(ann.width);
          const nh = n(ann.height);
          return {
            id: item.attrId, label: item.label, changeType: item.expectedChange, category: item.category,
            satisfied: item.satisfied, x: n(ann.x), y: n(ann.y), width: nw > 0 ? nw : DEFAULT_W, height: nh > 0 ? nh : DEFAULT_H,
          };
        }
        const pos = {
          id: item.attrId, label: item.label, changeType: item.expectedChange, category: item.category,
          satisfied: item.satisfied, x: 0.01, y: 0.01 + fallbackIdx * (DEFAULT_H + GAP), width: DEFAULT_W, height: DEFAULT_H,
        };
        fallbackIdx++;
        return pos;
      });

      unexpectedAnnotations = aiAnnotations.filter((_, idx) => !usedAnnIdx.has(idx));
    }
  }

  return {
    validatedParsedItems,
    missingItems,
    satisfiedItems,
    requirementBoxes,
    unexpectedAnnotations,
    currentAnnotations,
    bboxDiscrepancyIds,
    parsedItems,
  };
}
