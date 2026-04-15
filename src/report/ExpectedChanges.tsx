import { useState } from 'react';
import { Badge } from './Badge';
import type { Requirement, RequirementStatus } from './types';
import { type ProofRequestMissingItem } from '@/data/dummyData';
import { ATTRIBUTE_LOOKUP } from '@/data/attributes';
import type { ProofRequestChangeItem } from '@/data/dummyData';

// ─────────────────────────────────────────────────────────────────────────────
// PDF-style unified table (used in FrameC — full comparison mode)
// Columns: # | ELEMENT | CHANGE TYPE | REQUIREMENTS | EXPECTED | ACTUAL | STATUS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RequirementStatus, string> = {
  Match:   '#16a34a',
  Mismatch: '#dc2626',
};

export function ExpectedChangesTable({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">Expected Changes</h4>
        <div className="border border-gray-300 px-4 py-6 text-center text-xs text-gray-400 italic bg-white">
          No expected changes recorded.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">Expected Changes</h4>
      <div className="border border-gray-300 overflow-hidden">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              {['#', 'Element', 'Change Type', 'Requirements', 'Expected', 'Actual', 'Status'].map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2.5 text-left font-bold text-gray-800 text-[11px] uppercase tracking-wide ${i < 6 ? 'border-r border-gray-200' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => (
              <tr key={req.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2 border-r border-gray-200 text-gray-700" style={{ wordBreak: 'break-word' }}>{req.id}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.elementType}</td>
                <td className="px-3 py-2 border-r border-gray-200" style={{ wordBreak: 'break-word' }}>
                  <Badge type={req.changeType as any} />
                </td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.description}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.expectedValue}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.actualValue}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold text-[11px]" style={{ color: STATUS_COLORS[req.status] }}>
                    {req.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy tabbed view (used in FrameB — form-only mode, no AI comparison)
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'Text' | 'Symbols' | 'Barcodes' | 'Images';
const TABS: Tab[] = ['Text', 'Symbols', 'Barcodes', 'Images'];
const TAB_TO_CATEGORY: Record<Tab, string> = {
  Text: 'Text', Symbols: 'Symbol', Barcodes: 'Barcode', Images: 'Image',
};

interface FormData {
  changes: Record<string, { changeType: string; expectedValue: string }>;
}

function buildItemsFromFormData(
  formData: FormData,
  satisfiedItems: ProofRequestMissingItem[] = [],
  missingItems: ProofRequestMissingItem[]   = [],
): ProofRequestChangeItem[] {
  const satisfiedByLabel = new Map(satisfiedItems.map(i => [i.label, i]));
  const missingLabels    = new Set(missingItems.map(i => i.label));

  return Object.entries(formData.changes).map(([id, change]) => {
    const lookup        = ATTRIBUTE_LOOKUP[id];
    const label         = lookup?.label ?? id;
    const satisfiedItem = satisfiedByLabel.get(label);
    const found         = !!satisfiedItem;
    return {
      id,
      category:      lookup?.category ?? 'Text',
      label,
      changeType:    change.changeType,
      expectedValue: change.expectedValue,
      actualValue:   found
        ? (satisfiedItem.actualValue ?? change.expectedValue)
        : missingLabels.has(label) ? '— NOT FOUND —'
        : '— PENDING —',
      found,
    };
  });
}

function TabbedChangesTable({ items }: { items: ProofRequestChangeItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-6">No changes in this category</p>;
  }
  return (
    <div className="flex gap-4 items-start">
      <table className="flex-1 border-collapse border border-gray-300 text-sm">
        <thead>
          <tr>
            <th colSpan={3} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide bg-[#eff6ff] border-t-4 border-t-[#3b82f6] border-b border-b-gray-300" style={{ color: '#2563eb' }}>
              Required Changes
            </th>
          </tr>
          <tr className="border-b border-gray-300">
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#eff6ff] border-r border-gray-200 w-44">Attribute</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#eff6ff] border-r border-gray-200 w-32">Change Type</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#eff6ff]">Expected Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-200 last:border-0">
              <td className="px-4 py-2 text-gray-700 bg-[#eff6ff] border-r border-gray-200">{item.label}</td>
              <td className="px-4 py-2 bg-[#eff6ff] border-r border-gray-200"><Badge type={item.changeType as any} /></td>
              <td className="px-4 py-2 text-gray-700 font-mono text-xs bg-[#eff6ff]">{item.expectedValue}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="flex-1 border-collapse border border-gray-300 text-sm">
        <thead>
          <tr>
            <th colSpan={3} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide bg-[#f0fdf4] border-t-4 border-t-[#22c55e] border-b border-b-gray-300" style={{ color: '#16a34a' }}>
              Changes Done
            </th>
          </tr>
          <tr className="border-b border-gray-300">
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#f0fdf4] border-r border-gray-200 w-44">Attribute</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#f0fdf4] border-r border-gray-200 w-32">Change Type</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500 font-bold bg-[#f0fdf4]">Actual Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-200 last:border-0">
              <td className="px-4 py-2 text-gray-700 bg-[#f0fdf4] border-r border-gray-200">{item.label}</td>
              <td className="px-4 py-2 bg-[#f0fdf4] border-r border-gray-200"><Badge type={item.changeType as any} /></td>
              <td className={`px-4 py-2 font-mono text-xs bg-[#f0fdf4] ${!item.found ? 'text-red-600 italic' : 'text-gray-700'}`}>
                {item.actualValue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ExpectedChangesProps {
  formData?: FormData;
  satisfiedItems?: ProofRequestMissingItem[];
  missingItems?: ProofRequestMissingItem[];
  requirements?: Requirement[];
}

export function ExpectedChanges({ formData, satisfiedItems, missingItems, requirements }: ExpectedChangesProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Text');

  // New unified table when requirements data is available (FrameC)
  if (requirements !== undefined) {
    return <ExpectedChangesTable requirements={requirements} />;
  }

  // Legacy tabbed view for FrameB (form-only, no comparison)
  const allItems = formData ? buildItemsFromFormData(formData, satisfiedItems, missingItems) : [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm uppercase tracking-wide font-bold text-gray-700">Required Changes</h3>

      {/* Screen: tabbed */}
      <div className="print:hidden">
        <div className="flex">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm transition-colors border border-b-0 -mb-px relative z-10 ${
                  isActive
                    ? 'bg-[#064b75] text-white border-[#064b75]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
        <div className="border border-gray-300 shadow-md bg-white">
          <div className="p-6">
            <TabbedChangesTable items={allItems.filter(c => c.category === TAB_TO_CATEGORY[activeTab])} />
          </div>
        </div>
      </div>

      {/* Print: all categories stacked */}
      <div className="hidden print:block space-y-6">
        {TABS.map((tab) => {
          const items = allItems.filter(c => c.category === TAB_TO_CATEGORY[tab]);
          if (items.length === 0) return null;
          return (
            <div key={tab} className="bg-white border border-gray-300">
              <div className="bg-[#064b75] text-white px-4 py-2 text-xs font-bold uppercase tracking-wide">
                {tab}
              </div>
              <div className="p-4">
                <TabbedChangesTable items={items} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
