import { Badge } from './Badge';
import type { UnexpectedChange } from './types';

interface UnexpectedChangesProps {
  changes: UnexpectedChange[];
  onDiscard?: (id: UnexpectedChange['id']) => void;
}

export function UnexpectedChanges({ changes, onDiscard }: UnexpectedChangesProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">Unexpected Changes</h4>
      {changes.length === 0 ? (
        <div
          className="border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-gray-400 italic bg-white"
          style={{ letterSpacing: '0.05em' }}
        >
          NO UNEXPECTED CHANGES
        </div>
      ) : (
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: onDiscard ? '57%' : '69%' }} />
              {onDiscard && <col style={{ width: '12%' }} />}
            </colgroup>
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                {['#', 'Element', 'Change Type', 'Actual', ...(onDiscard ? ['Action'] : [])].map((h, i, arr) => (
                  <th
                    key={h}
                    className={`px-3 py-2.5 text-left font-bold text-gray-800 text-[11px] uppercase tracking-wide ${i < arr.length - 1 ? 'border-r border-gray-200' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {changes.map((ch) => (
                <tr key={ch.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 border-r border-gray-200 text-gray-500">{ch.id}</td>
                  <td className="px-3 py-2 border-r border-gray-200 text-gray-800" style={{ wordBreak: 'break-word' }}>
                    {ch.elementType}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-200">
                    <Badge type={ch.changeType as any} />
                  </td>
                  <td className="px-3 py-2 text-gray-800" style={{ wordBreak: 'break-word' }}>
                    {ch.actual}
                  </td>
                  {onDiscard && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onDiscard(ch.id)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        Discard
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
