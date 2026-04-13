import { Type, Barcode, Image, Shield, ChevronDown, ChevronRight, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

type Category = "Text" | "Symbol" | "Barcode" | "Image";
type Status = "Matched Requirements" | "Missing Requirements";

export interface ValidationItem {
  id: string;
  label: string;
  category: Category;
  changeType: string;
  expectedValue: string;
  actualValue?: string;
  found: boolean;
}

const statusConfig: Record<Status, { label: string; borderClass: string; textClass: string }> = {
  "Matched Requirements": { label: "Matched Requirements", borderClass: "border-l-status-added", textClass: "text-status-added" },
  "Missing Requirements": { label: "Missing Requirements", borderClass: "border-l-[#D51900]", textClass: "text-[#D51900]" },
};

const categoryIcons: Record<string, typeof Type> = {
  Text: Type, Barcode, Image, Symbol: Shield,
};

const statusOrder: Status[] = ["Matched Requirements", "Missing Requirements"];

const CollapsibleGroup = ({
  title, icon: Icon, count, colorClass, children,
}: {
  title: string; icon: typeof XCircle; count: number; colorClass: string; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-secondary/30 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}>{title}</span>
        <span className="text-xs text-muted-foreground font-mono">({count})</span>
      </button>
      {open && <div className="ml-1 space-y-0.5 mt-0.5 mb-3">{children}</div>}
    </div>
  );
};

export const FormValidationDetails = ({ items = [] }: { items?: ValidationItem[] }) => {
  const missingItems = items.filter(c => !c.found);
  const matchedItems = items.filter(c => c.found);

  if (items.length === 0) {
    return (
      <div className="bg-card border border-border w-full shadow-sm rounded-sm">
        <div className="bg-secondary/50 px-4 py-2 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#333333]">Inspection Details</span>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
          No validation results yet. Run the analysis to see details.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border w-full shadow-sm rounded-sm">
      <div className="bg-secondary/50 px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#333333]">Inspection Details</span>
      </div>
      <div className="px-4 py-3">
        <CollapsibleGroup title="Missing Requirements" icon={XCircle} count={missingItems.length} colorClass="text-[#D51900]">
          {missingItems.map((item) => {
            const CatIcon = categoryIcons[item.category] || Type;
            return (
              <div key={item.id} className="border-l-2 border-[#D51900] pl-3 pr-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CatIcon className="h-3.5 w-3.5 mt-0.5 text-[#D51900] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs bg-[#fce8e6] text-[#D51900] px-1.5 py-0.5 rounded font-medium">{item.changeType}</span>
                        <span className="font-mono text-xs text-muted-foreground">Expected: <span className="text-foreground">{item.expectedValue}</span></span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-300">
                    Not Found
                  </span>
                </div>
              </div>
            );
          })}
        </CollapsibleGroup>

        <CollapsibleGroup title="Matched Requirements" icon={CheckCircle} count={matchedItems.length} colorClass="text-green-600">
          {matchedItems.map((item) => {
            const CatIcon = categoryIcons[item.category] || Type;
            return (
              <div key={item.id} className="border-l-2 border-green-500 pl-3 pr-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CatIcon className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">{item.changeType}</span>
                        <span className="font-mono text-xs text-muted-foreground">Actual: <span className="text-foreground">{item.actualValue || item.expectedValue}</span></span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-300">
                    Found
                  </span>
                </div>
              </div>
            );
          })}
        </CollapsibleGroup>
      </div>
    </div>
  );
};

export const FormValidationSummary = ({ items = [] }: { items?: ValidationItem[] }) => {
  const matchedItems = items.filter(c => c.found);
  const missingItems = items.filter(c => !c.found);

  const countByCategory = (subset: ValidationItem[]): Record<Category, number> =>
    (["Text", "Symbol", "Barcode", "Image"] as Category[]).reduce(
      (acc, cat) => ({ ...acc, [cat]: subset.filter(i => i.category === cat).length }),
      {} as Record<Category, number>
    );

  const counts: Record<Status, Record<Category, number>> = {
    "Matched Requirements": countByCategory(matchedItems),
    "Missing Requirements": countByCategory(missingItems),
  };

  const totalsByStatus: Record<Status, number> = {
    "Matched Requirements": matchedItems.length,
    "Missing Requirements": missingItems.length,
  };

  const total = items.length;

  return (
    <div className="bg-card border border-border w-full shadow-sm rounded-sm">
      <div className="bg-secondary/50 px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#333333]">Form Validation Summary</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {total === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground italic">
            No validation data yet. Run the analysis to see results.
          </div>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-semibold text-foreground">Total Validated Elements:</span>{" "}
              <span className="font-mono font-bold">{total}</span>
            </div>
            <div className="flex gap-12 text-sm">
              {statusOrder.map((status) => {
                const cfg = statusConfig[status];
                const categoryBreakdown = counts[status];
                return (
                  <div key={status}>
                    <div className="flex items-baseline gap-2 pb-3 border-b border-border">
                      <span className={`font-semibold ${cfg.textClass}`}>{status}:</span>
                      <span className={`font-mono font-bold ${cfg.textClass}`}>{totalsByStatus[status]}</span>
                    </div>
                    <div className="space-y-1 pt-3">
                      {(["Text", "Symbol", "Barcode", "Image"] as Category[]).map((cat) => {
                        const CatIcon = categoryIcons[cat] || Type;
                        const catCount = categoryBreakdown[cat];
                        return (
                          <div key={cat} className="flex items-center gap-2 text-sm">
                            <CatIcon className={`h-4 w-4 shrink-0 ${catCount > 0 ? cfg.textClass + '/70' : 'text-muted-foreground'}`} />
                            <span className={catCount > 0 ? cfg.textClass : "text-muted-foreground"}>{cat}:</span>
                            <span className={`font-mono font-semibold ml-auto ${catCount > 0 ? cfg.textClass : "text-muted-foreground"}`}>{catCount}</span>
                          </div>
                        );
                      })}
                    </div>
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
