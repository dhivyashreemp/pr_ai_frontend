import { useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnnotationElementType = 'Text' | 'Symbol' | 'Barcode' | 'DataMatrix' | 'Image';
type AnnotationDisposition = 'Expected' | 'Unexpected';

interface UserAnnotation {
  id: string;
  type: string;
  top: number; left: number; width: number; height: number;
  text?: string;
  target: 'base' | 'new';
  groupId: string;
  elementType: AnnotationElementType;
  disposition: AnnotationDisposition;
}

export interface AnnotationsPanelProps {
  annotations: UserAnnotation[];
  hoveredId: string | null;
  selectedId: string | null;
  isDrawMode: boolean;
  onHoverAnnotation:  (id: string | null) => void;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  Modified: 'bg-blue-100 text-blue-700',
  Added:    'bg-green-100 text-green-700',
  Deleted:  'bg-red-100 text-red-600',
};

function groupAnnotations(annotations: UserAnnotation[]) {
  const map = new Map<string, UserAnnotation[]>();
  for (const ann of annotations) {
    const arr = map.get(ann.groupId) ?? [];
    arr.push(ann);
    map.set(ann.groupId, arr);
  }
  return Array.from(map.entries()).map(([groupId, boxes]) => ({
    groupId,
    boxes,
    type:        boxes[0].type,
    text:        boxes[0].text ?? '',
    elementType: boxes[0].elementType,
    disposition: boxes[0].disposition,
  }));
}

// ─── Panel content (shared between desktop column and mobile drawer) ──────────

const PanelContent = ({
  annotations,
  hoveredId,
  selectedId,
  isDrawMode,
  onHoverAnnotation,
  onSelectAnnotation,
  onDeleteAnnotation,
}: AnnotationsPanelProps) => {
  // Newest annotation first
  const groups = useMemo(
    () => [...groupAnnotations(annotations)].reverse(),
    [annotations],
  );

  return (
    <div
      className={`flex flex-col h-full bg-white overflow-hidden${
        isDrawMode ? ' border-t-2 border-t-blue-400' : ''
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Reviewer Annotations
        </span>
        {groups.length > 0 && (
          <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5 font-medium">
            {groups.length}
          </span>
        )}
        {isDrawMode && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
            <span className="text-[10px] font-semibold text-blue-600">Recording…</span>
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Pencil className="w-8 h-8 text-gray-200" />
            <p className="text-xs text-gray-400 leading-relaxed">
              No annotations yet
              <br />
              <span className="text-gray-300">Enable Draw Mode to start</span>
            </p>
          </div>
        ) : (
          groups.map((group, idx) => {
            const isHovered  = hoveredId  === group.groupId;
            const isSelected = selectedId === group.groupId;
            const number     = groups.length - idx;   // oldest = #1
            return (
              <div
                key={group.groupId}
                className={`border rounded-lg p-3 mb-2 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-[#d51900] bg-red-50'
                    : isHovered
                    ? 'bg-gray-50 border-gray-300'
                    : 'bg-white border-gray-200'
                }`}
                style={{ animationName: 'apFadeIn', animationDuration: '200ms', animationFillMode: 'both' }}
                onMouseEnter={() => onHoverAnnotation(group.groupId)}
                onMouseLeave={() => onHoverAnnotation(null)}
                onClick={() => onSelectAnnotation(isSelected ? null : group.groupId)}
              >
                {/* Row 1 — type badge + number + delete */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      TYPE_BADGE[group.type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {group.type}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">#{number}</span>
                    <button
                      className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded"
                      onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(group.groupId); }}
                      title="Delete annotation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2 — comment */}
                <p
                  className={`text-sm mb-1.5 leading-snug ${
                    group.text ? 'text-gray-700' : 'text-gray-300 italic'
                  }`}
                >
                  {group.text || 'No comment'}
                </p>

                {/* Row 3 — element + section pills */}
                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  <span className="bg-gray-100 text-gray-500 text-xs rounded px-1.5 py-0.5">
                    {group.elementType}
                  </span>
                  <span
                    className={`text-xs rounded px-1.5 py-0.5 ${
                      group.disposition === 'Expected'
                        ? 'bg-teal-50 text-teal-600'
                        : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    {group.disposition}
                  </span>
                </div>

                {/* Row 4 — location count */}
                <div className="text-xs text-gray-400">
                  {group.boxes.length} {group.boxes.length === 1 ? 'box' : 'boxes'}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes apFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Exported panel: desktop column + mobile drawer ──────────────────────────

const AnnotationsPanel = (props: AnnotationsPanelProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const count = useMemo(
    () => groupAnnotations(props.annotations).length,
    [props.annotations],
  );

  return (
    <>
      {/* Desktop: fixed right column (lg+) */}
      <aside className="hidden lg:flex w-[300px] shrink-0 h-full border-l border-gray-200">
        <div className="flex-1 flex flex-col min-h-0">
          <PanelContent {...props} />
        </div>
      </aside>

      {/* Mobile: floating button + slide-in drawer (below lg) */}
      <div className="lg:hidden">
        {/* Floating action button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full px-3 py-2 text-xs font-semibold text-gray-700 hover:shadow-xl transition-shadow"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-500" />
          Annotations
          {count > 0 && (
            <span className="bg-[#d51900] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ml-1">
              {count}
            </span>
          )}
        </button>

        {/* Backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Drawer */}
        <div
          className={`fixed right-0 top-0 h-full w-[300px] z-50 shadow-xl border-l border-gray-200 transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-end px-3 pt-2 shrink-0 bg-white border-b border-gray-100">
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PanelContent {...props} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnnotationsPanel;
