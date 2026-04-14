import { Badge } from './Badge';
import type { Requirement } from './types';

const staticRequirements: Requirement[] = [
  { id: 1, elementType: 'Text',   changeType: 'Modified', description: 'Trademark ® change to ™',                               expectedValue: '™',                             actualValue: '™',             status: 'Match' },
  { id: 2, elementType: 'Symbol', changeType: 'Deleted',  description: 'Remove CE mark',                                         expectedValue: 'CE mark removed',                actualValue: 'CE mark removed', status: 'Match' },
  { id: 3, elementType: 'Text',   changeType: 'Modified', description: 'All Revisions change to the next consecutive character',  expectedValue: 'Next consecutive character',     actualValue: 'Next consecutive character', status: 'Match' },
  { id: 4, elementType: 'Symbol', changeType: 'Deleted',  description: 'Remove EC REP symbol from labels where applicable',       expectedValue: 'EC REP symbol removed',          actualValue: 'EC REP symbol removed', status: 'Match' },
  { id: 5, elementType: 'Symbol', changeType: 'Deleted',  description: 'Remove EC REP address from labels where applicable',      expectedValue: 'EC REP address removed',         actualValue: 'EC REP address removed', status: 'Match' },
  { id: 6, elementType: 'Symbol', changeType: 'Added',    description: 'Add MR Conditional symbol',                              expectedValue: 'MR Conditional symbol present',  actualValue: 'MR Conditional symbol present', status: 'Match' },
];

export function MissingChanges({ requirements }: { requirements?: Requirement[] }) {
  const reqs = requirements ?? staticRequirements;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Requirements Summary</h3>
        <span className="text-xs px-2.5 py-1 border border-gray-300 bg-gray-50 text-gray-700 font-semibold">
          {reqs.length} Requirements
        </span>
      </div>
      <div className="border border-gray-300 overflow-hidden">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '44%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              {['#', 'Element', 'Change Type', 'Requirements', 'Expected'].map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2.5 text-left font-bold text-gray-800 text-[11px] uppercase tracking-wide ${i < 4 ? 'border-r border-gray-200' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reqs.map((req) => (
              <tr key={req.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2 border-r border-gray-200 text-gray-700" style={{ wordBreak: 'break-word' }}>{req.id}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.elementType}</td>
                <td className="px-3 py-2 border-r border-gray-200" style={{ wordBreak: 'break-word' }}>
                  <Badge type={req.changeType as any} />
                </td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.description}</td>
                <td className="px-3 py-2 text-gray-800" style={{ wordBreak: 'break-word' }}>{req.expectedValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
