import { CategoryId } from "@/types/form";

interface SummaryBarProps {
  counts: Record<CategoryId, number>;
}

const chipStyles: Record<CategoryId, string> = {
  text: "bg-badge-blue text-badge-blue-foreground",
  symbol: "bg-badge-amber text-badge-amber-foreground",
  barcode: "bg-badge-green text-badge-green-foreground",
  image: "bg-badge-rose text-badge-rose-foreground",
};

const chipLabels: Record<CategoryId, string> = {
  text: "Text",
  symbol: "Symbols",
  barcode: "Barcodes",
  image: "Images",
};

const SummaryBar = ({ counts }: SummaryBarProps) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3">
      <span className="text-sm font-medium text-foreground">Summary:</span>
      {(Object.keys(chipLabels) as CategoryId[]).map((cat) =>
        counts[cat] > 0 ? (
          <span
            key={cat}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${chipStyles[cat]}`}
          >
            {chipLabels[cat]}: {counts[cat]}
          </span>
        ) : null
      )}
    </div>
  );
};

export default SummaryBar;
