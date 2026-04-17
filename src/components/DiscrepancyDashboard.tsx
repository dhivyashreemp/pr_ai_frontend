import {
  Plus,
  Trash2,
  Pencil,
  ArrowRightLeft,
  Type,
  Barcode,
  Image,
  Shield,
  QrCode,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { type DiscrepancyItem, type ProofRequestMissingItem } from "@/data/dummyData";
import { FormDataContextView } from "@/components/FormDataContextView";

// Define Form Data type structure inline for prop
interface FormDataContext {
  metadata: {
    cr_number: string;
    product_name: string;
  };
  [key: string]: any;
}

type Status = "Deleted" | "Added" | "Modified" | "Repositioned";

const statusConfig: Record<Status, { icon: typeof Plus; label: string; borderClass: string; textClass: string }> = {
  Deleted: { icon: Trash2, label: "Remove", borderClass: "border-l-status-deleted", textClass: "text-status-deleted" },
  Added: { icon: Plus, label: "Add", borderClass: "border-l-status-added", textClass: "text-status-added" },
  Modified: { icon: Pencil, label: "Modify", borderClass: "border-l-status-modified", textClass: "text-status-modified" },
  Repositioned: { icon: ArrowRightLeft, label: "Repositioned", borderClass: "border-l-status-misplaced", textClass: "text-status-misplaced" },
};

const categoryIcons: Record<string, typeof Type> = {
  Text: Type,
  Barcode: Barcode,
  DataMatrix: QrCode,
  Image: Image,
  Symbol: Shield,
};

const statusOrder: Status[] = ["Deleted", "Added", "Modified", "Repositioned"];

type Category = "Text" | "Symbol" | "Barcode" | "DataMatrix" | "Image";

function computeCounts(items: DiscrepancyItem[]) {
  const byStatus: Record<Status, number> = { Deleted: 0, Added: 0, Modified: 0, Repositioned: 0 };
  const byStatusAndCategory: Record<Status, Record<Category, number>> = {
    Deleted: { Text: 0, Symbol: 0, Barcode: 0, DataMatrix: 0, Image: 0 },
    Added: { Text: 0, Symbol: 0, Barcode: 0, DataMatrix: 0, Image: 0 },
    Modified: { Text: 0, Symbol: 0, Barcode: 0, DataMatrix: 0, Image: 0 },
    Repositioned: { Text: 0, Symbol: 0, Barcode: 0, DataMatrix: 0, Image: 0 },
  };
  items.forEach((item) => {
    byStatus[item.status]++;
    byStatusAndCategory[item.status][item.category as Category]++;
  });
  return { byStatus, byStatusAndCategory, total: items.length };
}



const InspectionSummary = ({ items, formData, missingItems = [], satisfiedItems = [] }: { items: DiscrepancyItem[]; formData?: FormDataContext; missingItems?: ProofRequestMissingItem[]; satisfiedItems?: ProofRequestMissingItem[] }) => {
  const { byStatus, byStatusAndCategory, total } = computeCounts(items);

  const missingCounts = missingItems.reduce(
    (acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const missingCountsByCat = { Text: missingCounts["Text"] || 0, Symbol: missingCounts["Symbol"] || 0, Barcode: missingCounts["Barcode"] || 0, DataMatrix: missingCounts["DataMatrix"] || 0, Image: missingCounts["Image"] || 0 };
  const totalMissing = missingItems.length;

  const satisfiedCounts = satisfiedItems.reduce(
    (acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const satisfiedCountsByCat = { Text: satisfiedCounts["Text"] || 0, Symbol: satisfiedCounts["Symbol"] || 0, Barcode: satisfiedCounts["Barcode"] || 0, DataMatrix: satisfiedCounts["DataMatrix"] || 0, Image: satisfiedCounts["Image"] || 0 };
  const totalSatisfied = satisfiedItems.length;

  return (
    <div className="bg-card border border-border">
      <div className="bg-secondary/50 px-4 py-2 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Inspection Summary</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Total Differences count is only meaningful in direct comparison mode.
            In form / proof-request mode show only requirement-based counts. */}
        {!formData && (
          <div className="text-sm">
            <span className="font-semibold text-foreground">Total Differences:</span>{" "}
            <span className="font-mono font-bold">{total}</span>
          </div>
        )}

        {formData ? (
          <>
            {/* Totals Row */}
            <div className="grid grid-cols-2 gap-8 text-sm pb-3 border-b border-border">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-green-600">Requirements Satisfied:</span>
                <span className="font-mono font-bold text-green-600">{totalSatisfied}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-[#D51900]">Proof Request Missing:</span>
                <span className="font-mono font-bold text-[#D51900]">{totalMissing}</span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-2 gap-8 text-sm pt-3">
              <div className="space-y-1">
                {(["Text", "Symbol", "Barcode", "DataMatrix", "Image"] as Category[]).map((cat) => {
                  const CatIcon = categoryIcons[cat] || Type;
                  const catCount = satisfiedCountsByCat[cat];
                  return (
                    <div key={`satisfied-${cat}`} className="flex items-center gap-2 text-sm">
                      <CatIcon className="h-4 w-4 text-green-600/60 shrink-0" />
                      <span className={catCount > 0 ? "text-green-600" : "text-muted-foreground"}>{cat}:</span>
                      <span className={`font-mono font-semibold ml-auto ${catCount > 0 ? "text-green-600" : "text-muted-foreground"}`}>{catCount}</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1">
                {(["Text", "Symbol", "Barcode", "DataMatrix", "Image"] as Category[]).map((cat) => {
                  const CatIcon = categoryIcons[cat] || Type;
                  const catCount = missingCountsByCat[cat];
                  return (
                    <div key={`missing-${cat}`} className="flex items-center gap-2 text-sm">
                      <CatIcon className="h-4 w-4 text-[#D51900]/60 shrink-0" />
                      <span className={catCount > 0 ? "text-[#D51900]" : "text-muted-foreground"}>{cat}:</span>
                      <span className={`font-mono font-semibold ml-auto ${catCount > 0 ? "text-[#D51900]" : "text-muted-foreground"}`}>{catCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Raw diff mode: 4 status columns */}
            <div className="grid grid-cols-4 gap-8 text-sm pb-3 border-b border-border">
              {statusOrder.map((status) => {
                const cfg = statusConfig[status];
                const statusCount = byStatus[status];
                return (
                  <div key={status} className="flex items-baseline gap-2">
                    <span className={`font-semibold ${cfg.textClass}`}>{status}:</span>
                    <span className={`font-mono font-bold ${cfg.textClass}`}>{statusCount}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-8 text-sm pt-3">
              {statusOrder.map((status) => {
                const categoryBreakdown = byStatusAndCategory[status];
                return (
                  <div key={`${status}-cats`} className="space-y-1">
                    {(["Text", "Symbol", "Barcode", "DataMatrix", "Image"] as Category[]).map((cat) => {
                      const CatIcon = categoryIcons[cat] || Type;
                      const catCount = categoryBreakdown[cat];
                      return (
                        <div key={cat} className="flex items-center gap-2 text-sm">
                          <CatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className={catCount > 0 ? "text-foreground" : "text-muted-foreground"}>{cat}:</span>
                          <span className={`font-mono font-semibold ml-auto ${catCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>{catCount}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Inline diff for Modified items
const DiffView = ({ oldText, newText }: { oldText: string; newText: string }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-xs mt-1">
    <span className="bg-status-deleted-bg px-1.5 py-0.5 line-through text-status-deleted/80">
      {oldText}
    </span>
    <span className="text-muted-foreground">→</span>
    <span className="bg-status-added-bg px-1.5 py-0.5 text-status-added/80">
      {newText}
    </span>
  </span>
);

// Label row for a Before/After breakdown line
// Single row
const DiscrepancyRow = ({ item, status, showValidity }: { item: DiscrepancyItem; status: Status; showValidity?: boolean }) => {
  const config = statusConfig[status];
  const CatIcon = categoryIcons[item.category] || Type;

  // Resolve old/new — prefer structured detail fields, fall back to value string parsing
  const oldText = item.detail?.old_value ?? item.oldText;
  const newText = item.detail?.new_value ?? item.newText;

  let resolvedOld = oldText;
  let resolvedNew = newText;
  if (!resolvedOld && !resolvedNew && status === "Modified") {
    // "From: 'X' ➔ To: 'Y'" (Text)
    const m1 = item.value.match(/From:\s*'([\s\S]*?)'\s*➔\s*To:\s*'([\s\S]*?)'/);
    if (m1) { resolvedOld = m1[1]; resolvedNew = m1[2]; }
    else {
      // "A → B" or "A ➔ B" (Symbol / Barcode AI descriptions)
      const m2 = item.value.match(/^([\s\S]+?)\s*[→➔]\s*([\s\S]+)$/);
      if (m2) { resolvedOld = m2[1].trim(); resolvedNew = m2[2].trim(); }
    }
  }

  // For Added/Deleted: resolve what the single-side content is
  const baseContent = (item.detail?.old_value ?? item.detail?.value ?? item.detail?.iso_name ?? item.detail?.description ?? item.value) || "";
  const childContent = (item.detail?.new_value ?? item.detail?.value ?? item.detail?.iso_name ?? item.detail?.description ?? item.value) || "";

  const regionCount = item.detail?.regions?.length ?? 0;
  const isUnexpected = showValidity && item.isValid === false;
  // Show structured breakdown when: unexpected (form mode) OR direct comparison (no form, detail available)
  const showBreakdown = isUnexpected || (!showValidity && !!item.detail);

  return (
    <div className={`border-l-2 ${config.borderClass} pl-3 pr-4 py-2.5`}>
      <div className="flex items-start gap-2.5">
        <CatIcon className={`h-3.5 w-3.5 mt-0.5 ${config.textClass} shrink-0`} />
        <div className="min-w-0 flex-1">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground leading-snug">{item.value}</span>
            {showValidity && item.isValid !== undefined && (
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                item.isValid
                  ? "bg-green-50 text-green-700 border-green-300"
                  : "bg-red-50 text-red-700 border-red-300"
              }`}>
                {item.isValid ? "Valid" : "Invalid"}
              </span>
            )}
          </div>

          {/* Inline diff (quick visual) for Modified — always show when available */}
          {resolvedOld && resolvedNew && (
            <div className="mt-1">
              <DiffView oldText={resolvedOld} newText={resolvedNew} />
            </div>
          )}

          {/* ══ From / To breakdown ══ */}
          {showBreakdown && (
            <div className="mt-1.5 space-y-1 text-[11px]">

              {/* Type badge */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${config.textClass} bg-current/10`}
                  style={{ backgroundColor: "transparent" }}>
                  <span className={`${config.textClass}`}>{status}</span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground capitalize">{item.category}</span>
                {item.detail?.field_label && item.category === "Text" && (
                  <><span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground font-mono">{item.detail.field_label}</span></>
                )}
              </div>

              {/* ── Image / background: show location + region proof ── */}
              {item.category === "Image" ? (
                <>
                  {item.bounding_box && item.bounding_box.width > 0 ? (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-500 w-14 shrink-0 pt-0.5">Location:</span>
                      <span className="font-mono text-foreground">
                        x {(item.bounding_box.x * 100).toFixed(1)}%,
                        {" "}y {(item.bounding_box.y * 100).toFixed(1)}%
                        {" "}— {(item.bounding_box.width * 100).toFixed(1)}w × {(item.bounding_box.height * 100).toFixed(1)}h%
                        {item.bounding_box.confidence && (
                          <span className={`ml-1.5 ${item.bounding_box.confidence === "high" ? "text-green-600" : "text-yellow-600"}`}>
                            [{item.bounding_box.confidence}]
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-500 w-14 shrink-0 pt-0.5">Location:</span>
                      <span className="italic text-muted-foreground">bounding box not available</span>
                    </div>
                  )}
                  {regionCount > 0 ? (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-500 w-14 shrink-0 pt-0.5">Proof:</span>
                      <div className="flex-1 space-y-0.5">
                        <span className="text-foreground">
                          {regionCount} pixel-level region{regionCount !== 1 ? "s" : ""} differ between base and revised label
                        </span>
                        {item.detail?.regions?.slice(0, 3).map((r, i) => (
                          <div key={i} className="font-mono text-muted-foreground">
                            Region {i + 1}: x {(r.x * 100).toFixed(1)}%, y {(r.y * 100).toFixed(1)}%
                            {" "}— {(r.width * 100).toFixed(1)}w × {(r.height * 100).toFixed(1)}h%
                          </div>
                        ))}
                        {regionCount > 3 && (
                          <div className="text-muted-foreground">+{regionCount - 3} more region{regionCount - 3 !== 1 ? "s" : ""}…</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-500 w-14 shrink-0 pt-0.5">Proof:</span>
                      <span className="text-foreground">
                        Visual difference detected — a {status.toLowerCase()} background or image element was found between the two labels
                      </span>
                    </div>
                  )}
                </>
              ) : (
                /* ── Text / Symbol / Barcode: unified From / To ── */
                <>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-red-500 w-10 shrink-0 pt-0.5">From:</span>
                    <span className={`break-all ${item.category === "Text" ? "font-mono" : ""} text-foreground`}>
                      {status === "Added"
                        ? <span className="italic text-muted-foreground">— not present on base label</span>
                        : (resolvedOld || baseContent || <span className="italic text-muted-foreground">—</span>)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-green-600 w-10 shrink-0 pt-0.5">To:</span>
                    <span className={`break-all ${item.category === "Text" ? "font-mono" : ""} text-foreground`}>
                      {status === "Deleted"
                        ? <span className="italic text-muted-foreground">— removed from revised label</span>
                        : (resolvedNew || childContent || <span className="italic text-muted-foreground">—</span>)}
                    </span>
                  </div>
                </>
              )}

              {/* AI summary */}
              {item.summary && (
                <div className="flex items-start gap-1.5 pt-1 border-t border-gray-200 mt-1">
                  <span className="text-muted-foreground leading-snug">{item.summary}</span>
                </div>
              )}

              {/* Why flagged (unexpected only, shown when no AI summary) */}
              {isUnexpected && !item.summary && (
                <div className="flex items-start gap-1.5 pt-1 border-t border-orange-200 mt-1">
                  <AlertCircle className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                  <span className="text-orange-700">
                    {status === "Added"
                      ? `This ${item.category.toLowerCase()} was added on the revised label but was not listed in the proof request.`
                      : status === "Deleted"
                      ? `This ${item.category.toLowerCase()} was removed on the revised label but was not listed in the proof request.`
                      : `This ${item.category.toLowerCase()} was ${status.toLowerCase()} but was not listed in the proof request.`}
                  </span>
                </div>
              )}

            </div>
          )}

          {/* ── Compact fallback detail (items without backend detail data) ── */}
          {!showBreakdown && item.detail && (
            <div className="mt-1.5 space-y-0.5 text-[11px]">
              {item.category === "Text" && status === "Deleted" && item.detail.value && (
                <p className="text-muted-foreground font-mono">
                  Was: <span className="text-red-600">{item.detail.value}</span>
                </p>
              )}
              {item.category === "Text" && status === "Added" && item.detail.value && (
                <p className="text-muted-foreground font-mono">
                  Now: <span className="text-green-600">{item.detail.value}</span>
                </p>
              )}
              {item.category === "Symbol" && item.detail.description && (
                <p className="text-muted-foreground leading-snug">{item.detail.description}</p>
              )}
              {item.category === "Symbol" && item.detail.standard && (
                <p className="text-muted-foreground font-mono">Standard: {item.detail.standard}</p>
              )}
              {item.category === "Image" && regionCount > 0 && (
                <p className="text-muted-foreground">
                  {regionCount} changed region{regionCount !== 1 ? "s" : ""} detected
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Proof Request Satisfied group — changes expected by the form AND detected
const ProofRequestSatisfiedGroup = ({ items }: { items: ProofRequestMissingItem[] }) => {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-green-50/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-green-600">Requirements Satisfied</span>
        <span className="text-xs text-muted-foreground font-mono">({items.length})</span>
      </button>
      {open && (
        <div className="ml-1 space-y-0.5 mt-0.5 mb-3">
          {items.map((item) => {
            const CatIcon = categoryIcons[item.category] || Type;
            return (
              <div key={item.id} className="border-l-2 border-green-500 pl-3 pr-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CatIcon className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">{item.expectedChange}</span>
                        {item.expectedValue && item.expectedValue !== "—" && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Expected: <span className="text-foreground">{item.expectedValue}</span>
                          </span>
                        )}
                        {item.actualValue && item.actualValue !== "—" && (
                          item.actualValue.includes("\n") ? (
                            <div className="font-mono text-xs text-muted-foreground mt-0.5">
                              <span className="mr-1">Actual:</span>
                              {item.actualValue.split("\n").map((line, i) => (
                                <div key={i} className="ml-2 text-green-700 font-medium">{line}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              Actual: <span className="text-green-700 font-medium">{item.actualValue}</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-300">
                    Satisfied
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Proof Request Missing group — changes expected by the form but not detected
const ProofRequestMissingGroup = ({ items }: { items: ProofRequestMissingItem[] }) => {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-[#fce8e6]/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <X className="h-3.5 w-3.5 text-[#D51900]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#D51900]">Proof Request Missing</span>
        <span className="text-xs text-muted-foreground font-mono">({items.length})</span>
      </button>
      {open && (
        <div className="ml-1 space-y-0.5 mt-0.5 mb-3">
          {items.map((item) => {
            const CatIcon = categoryIcons[item.category] || Type;
            return (
              <div key={item.id} className="border-l-2 border-[#D51900] pl-3 pr-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CatIcon className="h-3.5 w-3.5 mt-0.5 text-[#D51900] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs bg-[#fce8e6] text-[#D51900] px-1.5 py-0.5 rounded font-medium">{item.expectedChange}</span>
                        {item.expectedValue && item.expectedValue !== "—" && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Expected: <span className="text-foreground">{item.expectedValue}</span>
                          </span>
                        )}
                        {item.actualValue && item.actualValue !== "—" && (
                          item.actualValue.includes("\n") ? (
                            <div className="font-mono text-xs text-muted-foreground mt-0.5">
                              <span className="mr-1">Actual:</span>
                              {item.actualValue.split("\n").map((line, i) => (
                                <div key={i} className="ml-2 text-[#D51900] font-medium">{line}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              Actual: <span className="text-[#D51900] font-medium">{item.actualValue}</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-300">
                    Not Found
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Status group with collapse
const StatusGroup = ({ status, items, showValidity }: { status: Status; items: DiscrepancyItem[]; showValidity?: boolean }) => {
  const [open, setOpen] = useState(true);
  const config = statusConfig[status];
  const Icon = config.icon;

  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-secondary/30 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Icon className={`h-3.5 w-3.5 ${config.textClass}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${config.textClass}`}>{config.label}</span>
        <span className="text-xs text-muted-foreground font-mono">({items.length})</span>
      </button>
      {open && (
        <div className="ml-1 space-y-0.5 mt-0.5 mb-3">
          {items.map((item) => (
            <DiscrepancyRow key={item.id} item={item} status={status} showValidity={showValidity} />
          ))}
        </div>
      )}
    </div>
  );
};

// Unexpected Changes group — detected by AI but not requested in LRF
const UnexpectedChangesGroup = ({ items }: { items: DiscrepancyItem[] }) => {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-orange-50/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">Unexpected Changes</span>
        <span className="text-xs text-muted-foreground font-mono">({items.length})</span>
      </button>
      {open && (
        <div className="ml-1 space-y-0.5 mt-0.5 mb-3">
          {items.map((item) => (
            <DiscrepancyRow key={item.id} item={item} status={item.status as Status} showValidity={true} />
          ))}
        </div>
      )}
    </div>
  );
};

const DiscrepancyDashboard = ({ formData, passedDiscrepancies, missingItems = [], satisfiedItems = [] }: { formData?: FormDataContext, passedDiscrepancies?: DiscrepancyItem[], missingItems?: ProofRequestMissingItem[], satisfiedItems?: ProofRequestMissingItem[] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const grouped: Record<Status, DiscrepancyItem[]> = { Deleted: [], Added: [], Modified: [], Repositioned: [] };

  const displayItems = passedDiscrepancies ?? [];
  displayItems.forEach((item) => {
    if (grouped[item.status as Status]) {
      grouped[item.status as Status].push(item);
    }
  });

  return (
    <div className="space-y-4">
      {/* Scenario 2 Top Banner for Form Data */}
      {formData && (
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#fce8e6] border border-[#D51900]/20 rounded-md p-4 mb-4 flex justify-between items-center shadow-sm cursor-pointer hover:bg-[#fae1de] transition-colors group"
        >
          <div>
            <span className="text-xs font-bold text-[#D51900] uppercase tracking-wider mb-1 block group-hover:underline">Context: Form Submitted (Click to View)</span>
            <div className="text-sm text-[#333333]">
              Comparing against <span className="font-semibold">CR: {formData.metadata.cr_number || 'N/A'}</span> 
              {" "}({formData.metadata.product_name || 'N/A'})
            </div>
          </div>
          <div className="text-xs px-3 py-1 bg-white text-[#D51900] rounded-full border border-[#D51900]/20 font-semibold shadow-sm group-hover:bg-[#D51900] group-hover:text-white transition-colors">
            Read-Only Context Active
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && formData && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl relative flex flex-col"
            onClick={e => e.stopPropagation()} // exclude background click from closing
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-[#D51900]">Proof Request Context</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-500 hover:text-black p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 bg-[#F4F4F4]/30 min-h-0 flex-1">
              <FormDataContextView formData={formData} />
            </div>
          </div>
        </div>
      )}

      <InspectionSummary items={displayItems} formData={formData} missingItems={missingItems} satisfiedItems={satisfiedItems} />
      <div className="bg-card border border-border">
        <div className="bg-secondary/50 px-4 py-2 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Inspection Details</span>
        </div>
        <div className="px-4 py-3 divide-y divide-border">
          {formData && (
            <div className="py-2 first:pt-0">
              <ProofRequestSatisfiedGroup items={satisfiedItems} />
              <ProofRequestMissingGroup items={missingItems} />
              <UnexpectedChangesGroup items={displayItems.filter((item) => item.isValid === false)} />
            </div>
          )}
          {/* In proof-request mode the satisfied/missing groups already cover all
              requirement status — the raw diff groups add noise, so hide them. */}
          {!formData && statusOrder.map((status) => (
            <div key={status} className="py-2 last:pb-0">
              <StatusGroup status={status} items={grouped[status]} showValidity={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscrepancyDashboard;
