import { useState } from 'react';
import { Badge } from './Badge';
import { useTheme } from './ThemeContext';
import type { DiscrepancyCategory, ChangeType } from './types';

function groupByChangeType(items: { changeType: ChangeType; value: string }[]) {
  const order: ChangeType[] = ['Modified', 'Added', 'Deleted', 'Misplaced', 'Repositioned'];
  const map = new Map<ChangeType, string[]>();
  for (const item of items) {
    if (!map.has(item.changeType)) map.set(item.changeType, []);
    map.get(item.changeType)!.push(item.value);
  }
  return order.filter(ct => map.has(ct)).map(ct => ({ changeType: ct, values: map.get(ct)! }));
}

const staticCategories: DiscrepancyCategory[] = [
  {
    title: 'TEXT',
    items: [
      { changeType: 'Modified', value: 'Trademark has been changed to ™' },
      { changeType: 'Modified', value: 'Manufacturing date has been changed' },
      { changeType: 'Modified', value: 'The Revisions was changed to the next consecutive character.' },
      { changeType: 'Modified', value: 'The e-IFU symbol has been changed to e-IFU for US/Canada only.' },
    ],
  },
  {
    title: 'SYMBOLS',
    items: [
      { changeType: 'Deleted', value: 'CE mark has been removed' },
      { changeType: 'Deleted', value: 'EC REP symbol has been removed.' },
      { changeType: 'Deleted', value: 'EC REP address has been removed.' },
      { changeType: 'Added',   value: 'MR Conditional symbol has been added' },
    ],
  },
  {
    title: 'IMAGE',
    items: [
      { changeType: 'Modified', value: 'Background has been added in the size of the implant (11mm, 7)' },
    ],
  },
];

export function ReportDiscrepancyDetails({ categories: propCategories }: { categories?: DiscrepancyCategory[] }) {
  const { theme } = useTheme();
  // propCategories === undefined  →  no analysis data provided, use static demo
  // propCategories === []         →  analysis ran but found no differences
  // propCategories has items      →  show real analysis results
  const isDemo = propCategories === undefined;
  const source = isDemo ? staticCategories : propCategories;

  if (!isDemo && source.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm uppercase tracking-wide font-bold text-gray-700">Changes made</h3>
        <div className="bg-white border border-gray-300 px-5 py-6 text-center text-sm text-gray-400 italic">
          No differences detected.
        </div>
      </div>
    );
  }

  const colorForCategory = (items: { changeType: ChangeType }[]): string => {
    const types = items.map(i => i.changeType);
    if (types.includes('Deleted'))  return theme.statusColors.deleted ?? '#dc2626';
    if (types.includes('Added'))    return theme.statusColors.added ?? '#16a34a';
    if (types.includes('Modified')) return theme.statusColors.modified;
    return theme.statusColors.repositioned;
  };

  const categories = source.map(c => ({ title: c.title, color: colorForCategory(c.items), items: c.items }));
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(categories.map(c => c.title)));

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm uppercase tracking-wide font-bold text-gray-700">Changes made</h3>
      {categories.map((category) => {
        const isOpen = openSections.has(category.title);
        const grouped = groupByChangeType(category.items);
        return (
          <div key={category.title} className="bg-white border border-gray-300">
            <button onClick={() => toggleSection(category.title)}
              className="w-full border-l-4 px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              style={{ borderLeftColor: '#111827' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-gray-700 font-bold">{category.title}</span>
                <span className="text-xs px-2 py-0.5" style={{ backgroundColor: '#f3f4f6', color: '#111827' }}>
                  {category.items.length}
                </span>
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="bevel" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100">
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-700 font-bold border-r border-gray-200 w-36">Change Type</th>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wide text-gray-700 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((group) =>
                    group.values.map((val, vi) => (
                      <tr key={`${group.changeType}-${vi}`} className="border-b border-gray-200 last:border-0">
                        <td className="px-4 py-2 border-r border-gray-200 align-top">
                          <Badge type={group.changeType as any} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">{val}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
