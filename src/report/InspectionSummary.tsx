import { useTheme } from './ThemeContext';

const TextIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="square" />
  </svg>
);
const SymbolIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>
);
const BarcodeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M5 5v14M9 5v14M13 5v14M17 5v14M21 5v14" strokeLinecap="square" />
  </svg>
);
const ImageIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="18" height="18" rx="0" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>
);

interface SummaryData {
  deleted:  { text: number; symbol: number; barcode: number; image: number };
  added:    { text: number; symbol: number; barcode: number; image: number };
  modified: { text: number; symbol: number; barcode: number; image: number };
  misplaced:{ text: number; symbol: number; barcode: number; image: number };
}

interface InspectionSummaryProps {
  data?: SummaryData;
}

const defaultData: SummaryData = {
  deleted:  { text: 0, symbol: 3, barcode: 0, image: 0 },
  added:    { text: 0, symbol: 1, barcode: 0, image: 0 },
  modified: { text: 4, symbol: 0, barcode: 0, image: 1 },
  misplaced:{ text: 0, symbol: 0, barcode: 0, image: 0 },
};

export function ReportInspectionSummary({ data = defaultData }: InspectionSummaryProps) {
  const { theme } = useTheme();

  const totalDeleted  = Object.values(data.deleted).reduce((a, b) => a + b, 0);
  const totalAdded    = Object.values(data.added).reduce((a, b) => a + b, 0);
  const totalModified = Object.values(data.modified).reduce((a, b) => a + b, 0);
  const totalDiffs    = totalDeleted + totalAdded + totalModified;

  const categories = [
    { key: 'deleted'  as const, label: 'Deleted',  color: theme.statusColors.deleted,  count: totalDeleted },
    { key: 'added'    as const, label: 'Added',    color: theme.statusColors.added,    count: totalAdded },
    { key: 'modified' as const, label: 'Modified', color: theme.statusColors.modified, count: totalModified },
  ];

  const elementTypes = [
    { label: 'Text',    icon: <TextIcon />,    key: 'text'    as const },
    { label: 'Symbol',  icon: <SymbolIcon />,  key: 'symbol'  as const },
    { label: 'Barcode', icon: <BarcodeIcon />, key: 'barcode' as const },
    { label: 'Image',   icon: <ImageIcon />,   key: 'image'   as const },
  ];

  return (
    <div className="bg-white border border-gray-300 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Inspection Summary</div>
        <div className="text-sm font-bold text-gray-900">Total Differences: <span>{totalDiffs}</span></div>
      </div>
      <div className="grid grid-cols-4 gap-8 mb-4 pb-4 border-b border-gray-200">
        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}:</span>
            <span className="text-sm font-bold" style={{ color: cat.color }}>{cat.count}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-8">
        {categories.map((cat) => (
          <div key={cat.key} className="space-y-1.5">
            {elementTypes.map((el) => (
              <div key={el.key} className="flex items-center text-xs"
                style={{ color: data[cat.key][el.key] > 0 ? cat.color : undefined }}>
                <div className={`flex items-center gap-1.5 w-24 ${data[cat.key][el.key] > 0 ? '' : 'text-gray-500'}`}>
                  <span className={data[cat.key][el.key] > 0 ? '' : 'text-gray-400'}>{el.icon}</span>
                  <span>{el.label}:</span>
                </div>
                <span className={`font-medium ${data[cat.key][el.key] > 0 ? '' : 'text-gray-400'}`}>
                  {data[cat.key][el.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
