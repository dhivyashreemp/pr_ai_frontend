import type { ReportData } from './types';

interface MetadataRowProps {
  data: ReportData;
}

export function MetadataRow({ data }: MetadataRowProps) {
  const metadata = [
    { label: 'CR Number (Optional)', value: data.crNumber || '-', breakAll: false },
    { label: 'SKU', value: data.sku, breakAll: false },
    {
      label: 'Label Revision',
      breakAll: false,
      value: (
        <span className="flex items-center gap-1.5">
          <span>{data.currentRevision}</span>
          <span className="text-[#D71500]">→</span>
          <span>{data.newRevision}</span>
        </span>
      ),
    },
    { label: 'Current Version Label', value: data.currentLabelName, breakAll: true },
    { label: 'New Version Label',     value: data.newLabelName,     breakAll: true },
    { label: 'Inspected By', value: 'Susanne Piche', breakAll: false },
    { label: 'Date',         value: new Date().toISOString().split('T')[0], breakAll: false },
  ];

  return (
    <div className="report-metadata-bar bg-white border border-gray-300 grid" style={{ gridTemplateColumns: '0.7fr 0.7fr 1fr 1.5fr 1.5fr' }}>
      {metadata.map((item, index) => (
        <div
          key={index}
          className={`px-3 py-1.5 ${index < metadata.length - 1 ? 'border-r border-gray-300' : ''} ${
            item.label === 'Inspected By' || item.label === 'Date' ? 'hidden' : ''
          }`}
        >
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-1">{item.label}</div>
          <div className={`text-xs text-gray-900 ${item.breakAll ? 'break-all' : ''}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
