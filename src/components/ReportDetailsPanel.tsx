import { useState, useRef, useCallback, useMemo } from 'react';
import {
  ClipboardList, PenLine,
  ChevronLeft, ChevronRight,
  Pencil, Trash2, X,
  Type, Shapes, ScanLine, QrCode, ImageIcon,
} from 'lucide-react';
import { Badge } from '@/report/Badge';
import type { Requirement } from '@/report/types';
import {
  useSidebarState,
  PANEL_MIN_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_COLLAPSED_WIDTH,
} from '@/hooks/useSidebarState';

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

export interface ReportDetailsPanelProps {
  // Report Details data
  satisfiedItems: any[];
  missingItems: any[];
  parsedItems: any[];
  aiAnnotations: any[];  // raw AI annotation objects from backend (same source as /report)
  discardedUnexpectedIds: Set<string>;
  onDiscard: (id: string) => void;
  analysisRun: boolean;
  // Reviewer Annotations (user-drawn boxes)
  annotations: UserAnnotation[];
  hoveredId: string | null;
  selectedId: string | null;
  isDrawMode: boolean;
  onHoverAnnotation:  (id: string | null) => void;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Duplicated from ReportPage.tsx so this panel has no page-level import coupling.

function resolveMissingActual(item: any): string {
  const raw = item.actualValue ?? '';
  if (!raw || raw === '—') return '— NOT FOUND —';
  if (item.category === 'Barcode' || item.category === 'DataMatrix') {
    const lines = raw.split('\n');
    const childPrinted = lines.find((l: string) => l.startsWith('Child printed:'));
    if (childPrinted) {
      const val = childPrinted.replace('Child printed:', '').trim();
      if (val && val !== '(none)') return val;
    }
    const childDecoded = lines.find((l: string) => l.startsWith('Child decoded:'));
    if (childDecoded) {
      const val = childDecoded.replace('Child decoded:', '').trim();
      if (val && val !== '(none)') return val;
    }
    const label = item.category === 'DataMatrix' ? 'data matrix' : 'barcode';
    return `No change in the ${label}.`;
  }
  return raw;
}

function buildRequirements(satisfiedItems: any[], missingItems: any[]): Requirement[] {
  let id = 1;
  return [
    ...satisfiedItems.map((item: any) => ({
      id: id++,
      elementType: item.category as Requirement['elementType'],
      changeType:  item.expectedChange as Requirement['changeType'],
      description: item.label,
      expectedValue: item.expectedValue,
      actualValue:   item.actualValue ?? item.expectedValue,
      status: 'Match' as const,
    })),
    ...missingItems.map((item: any) => ({
      id: id++,
      elementType: item.category as Requirement['elementType'],
      changeType:  item.expectedChange as Requirement['changeType'],
      description: item.label,
      expectedValue: item.expectedValue,
      actualValue:   resolveMissingActual(item),
      status: 'Mismatch' as const,
    })),
  ];
}

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

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  Text:        <Type       className="w-3 h-3 shrink-0 text-gray-400" />,
  Symbol:      <Shapes     className="w-3 h-3 shrink-0 text-gray-400" />,
  Barcode:     <ScanLine   className="w-3 h-3 shrink-0 text-gray-400" />,
  DataMatrix:  <QrCode     className="w-3 h-3 shrink-0 text-gray-400" />,
  Image:       <ImageIcon  className="w-3 h-3 shrink-0 text-gray-400" />,
};

function CategoryIcon({ category }: { category: string }) {
  return <>{CATEGORY_ICON[category] ?? <Shapes className="w-3 h-3 shrink-0 text-gray-400" />}</>;
}

// ─── Annotation type badge colours ────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  Modified: 'bg-blue-100 text-blue-700',
  Added:    'bg-green-100 text-green-700',
  Deleted:  'bg-red-100 text-red-600',
};

// ─── Expected Changes card ────────────────────────────────────────────────────

const ExpectedCard = ({ req, idx }: { req: Requirement; idx: number }) => (
  <div className={`border border-gray-100 rounded-lg p-3 mb-2 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
    {/* Row 1: # + icon + category + change type badge */}
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-400 font-mono shrink-0">#{idx + 1}</span>
      <CategoryIcon category={req.elementType} />
      <span className="text-xs font-medium text-gray-600">{req.elementType}</span>
      <Badge type={req.changeType as any} />
    </div>
    {/* Row 2: description */}
    <p className="text-sm text-gray-700 font-medium mt-1 leading-snug">{req.description}</p>
    {/* Row 3: expected value */}
    {req.expectedValue && req.expectedValue !== '—' && (
      <div className="mt-1 flex items-start gap-1">
        <span className="text-xs text-gray-400 shrink-0">Expected:</span>
        <span className="text-xs text-gray-600 break-all">{req.expectedValue}</span>
      </div>
    )}
    {/* Row 4: actual value */}
    {req.actualValue && req.actualValue !== '—' && (
      <div className="mt-0.5 flex items-start gap-1">
        <span className="text-xs text-gray-400 shrink-0">Actual:</span>
        <span className="text-xs text-gray-600 break-all">{req.actualValue}</span>
      </div>
    )}
    {/* Row 5: status badge */}
    <div className="mt-2">
      <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
        req.status === 'Match'
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-600'
      }`}>
        {req.status === 'Match' ? 'Match' : 'Mismatch'}
      </span>
    </div>
  </div>
);

// ─── Unexpected Changes card ──────────────────────────────────────────────────

const UnexpectedCard = ({
  item,
  rowIdx,
  discarded,
  onDiscard,
}: {
  item: any;
  rowIdx: number;
  discarded: boolean;
  onDiscard: (id: string) => void;
}) => {
  const NORM: Record<string, string> = {
    added: 'Added', deleted: 'Deleted', modified: 'Modified',
    repositioned: 'Repositioned', misplaced: 'Misplaced',
    remove: 'Deleted', removed: 'Deleted',
  };
  const rawType  = item.changeType ?? item.change_type ?? item.status ?? 'Modified';
  const changeType = NORM[rawType.toLowerCase()] ?? rawType;
  return (
    <div className={`border border-gray-100 rounded-lg p-3 mb-2 ${discarded ? 'opacity-50 bg-gray-50' : rowIdx % 2 === 1 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50'} transition-colors`}>
      {/* Row 1: # + icon + category + change type + action */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-400 font-mono shrink-0">#{rowIdx + 1}</span>
        <CategoryIcon category={item.category ?? 'Text'} />
        <span className="text-xs font-medium text-gray-600">{item.category ?? '—'}</span>
        <Badge type={changeType as any} />
        <div className="ml-auto shrink-0">
          {discarded ? (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
              Discarded
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onDiscard(item._panelId)}
              className="text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded-md px-2 py-1 transition-colors shrink-0"
            >
              Discard
            </button>
          )}
        </div>
      </div>
      {/* Row 2: actual value / inline diff */}
      <div className="mt-1.5">
        {item.oldText && item.newText ? (
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <span className="text-gray-400 shrink-0">Actual:</span>
            <span className="line-through text-red-500">{item.oldText}</span>
            <span className="text-gray-400">→</span>
            <span className="text-green-600">{item.newText}</span>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <span className="text-xs text-gray-400 shrink-0">Actual:</span>
            <span className="text-sm text-gray-700 break-words">{item.value ?? '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({
  label,
  badge,
  topBorder = false,
  ref: forwardedRef,
}: {
  label: string;
  badge?: React.ReactNode;
  topBorder?: boolean;
  ref?: React.RefObject<HTMLDivElement>;
}) => (
  <div
    ref={forwardedRef}
    className={`px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 shrink-0${topBorder ? ' border-t-2 border-t-gray-200' : ''}`}
  >
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    {badge}
  </div>
);

// ─── Panel Content ─────────────────────────────────────────────────────────

interface PanelContentProps extends ReportDetailsPanelProps {
  annotationsRef?: React.RefObject<HTMLDivElement>;
}

const PanelContent = (props: PanelContentProps) => {
  const {
    satisfiedItems, missingItems, aiAnnotations,
    discardedUnexpectedIds, onDiscard, analysisRun,
    annotations, hoveredId, selectedId, isDrawMode,
    onHoverAnnotation, onSelectAnnotation, onDeleteAnnotation,
    annotationsRef,
  } = props;

  const requirements = useMemo(
    () => buildRequirements(satisfiedItems, missingItems),
    [satisfiedItems, missingItems],
  );

  // Mirror exactly what /report does: aiUnexpected built from raw AI annotations only.
  // parsedItems is NOT used here — /report never sources Unexpected Changes from parsedItems.
  const unexpectedItems = useMemo(
    () => aiAnnotations.map((ann: any, i: number) => ({
      _panelId:    `ai-${i}`,
      elementType: ann.category    ?? 'Text',
      changeType:  ann.change_type ?? 'Modified',
      category:    ann.category    ?? 'Text',
      value:       ann.label || ann.value || ann.change_type || 'AI-detected unexpected change',
      oldText:     undefined as string | undefined,
      newText:     undefined as string | undefined,
    })),
    [aiAnnotations],
  );

  const annotationGroups = useMemo(
    () => [...groupAnnotations(annotations)].reverse(),
    [annotations],
  );

  return (
    <div
      className={`flex flex-col h-full bg-white overflow-hidden${isDrawMode ? ' border-t-2 border-t-blue-400' : ''}`}
    >
      {/* ── Panel header ────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Report Details
        </span>
        {/* {isDrawMode && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
            <span className="text-[10px] font-semibold text-blue-600">Recording…</span>
          </div>
        )} */}
      </div>

      {/* ── Scrollable sections ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Section 1: Expected Changes ─────────────────────────────── */}
        <SectionHeader
          label="Expected Changes"
          badge={
            requirements.length > 0
              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{requirements.length}</span>
              : undefined
          }
        />
        <div className="p-3">
          {!analysisRun ? (
            <p className="text-[11px] text-gray-400 italic text-center py-4">No analysis run yet</p>
          ) : requirements.length === 0 ? (
            <div className="border border-dashed border-gray-300 px-4 py-4 text-center text-xs text-gray-400 italic">
              No expected changes recorded
            </div>
          ) : (
            requirements.map((req, idx) => (
              <ExpectedCard key={req.id} req={req} idx={idx} />
            ))
          )}
        </div>

        {/* ── Section 2: Unexpected Changes ───────────────────────────── */}
        <SectionHeader
          label="Unexpected Changes"
          topBorder
          badge={
            unexpectedItems.length > 0
              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{unexpectedItems.length}</span>
              : undefined
          }
        />
        <div className="p-3">
          {!analysisRun ? (
            <p className="text-[11px] text-gray-400 italic text-center py-4">No analysis run yet</p>
          ) : unexpectedItems.length === 0 ? (
            <div className="border border-dashed border-gray-300 px-4 py-4 text-center text-xs text-gray-400 italic">
              No unexpected changes detected
            </div>
          ) : (
            unexpectedItems.map((item: any, rowIdx: number) => (
              <UnexpectedCard
                key={item._panelId}
                item={item}
                rowIdx={rowIdx}
                discarded={discardedUnexpectedIds.has(item._panelId)}
                onDiscard={onDiscard}
              />
            ))
          )}
        </div>

        {/* ── Section 3: Reviewer Annotations ─────────────────────────── */}
        <div
          ref={annotationsRef}
          className="px-3 py-2 bg-gray-50 border-b border-gray-100 border-t-2 border-t-gray-200 flex items-center gap-2 shrink-0"
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Reviewer Annotations
          </span>
          {annotationGroups.length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
              {annotationGroups.length}
            </span>
          )}
        </div>
        <div className="p-3 pb-6">
          {annotationGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Pencil className="w-6 h-6 text-gray-200" />
              <p className="text-xs text-gray-400 leading-relaxed">
                No annotations yet
                <br />
                <span className="text-gray-300">Enable Edit Mode to start</span>
              </p>
            </div>
          ) : (
            annotationGroups.map((group, idx) => {
              const isHovered  = hoveredId  === group.groupId;
              const isSelected = selectedId === group.groupId;
              const number     = annotationGroups.length - idx;
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
                  style={{ animationName: 'rdpFadeIn', animationDuration: '200ms', animationFillMode: 'both' }}
                  onMouseEnter={() => onHoverAnnotation(group.groupId)}
                  onMouseLeave={() => onHoverAnnotation(null)}
                  onClick={() => onSelectAnnotation(isSelected ? null : group.groupId)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[group.type] ?? 'bg-gray-100 text-gray-600'}`}>
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
                  <p className={`text-sm mb-1.5 leading-snug ${group.text ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                    {group.text || 'No comment'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mb-1.5">
                    <span className="bg-gray-100 text-gray-500 text-xs rounded px-1.5 py-0.5">
                      {group.elementType}
                    </span>
                    <span className={`text-xs rounded px-1.5 py-0.5 ${
                      group.disposition === 'Expected' ? 'bg-teal-50 text-teal-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {group.disposition}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {group.boxes.length} {group.boxes.length === 1 ? 'box' : 'boxes'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes rdpFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Collapsed filmstrip ──────────────────────────────────────────────────────

interface CollapsedViewProps {
  hasAnalysis: boolean;
  hasAnnotations: boolean;
  onExpand: () => void;
}

const CollapsedView = ({ hasAnalysis, hasAnnotations, onExpand }: CollapsedViewProps) => (
  <div className="flex flex-col items-center gap-3 pt-10 pb-3 px-1">
    <button
      type="button"
      title="Report Details"
      onClick={onExpand}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
    >
      <ClipboardList className="w-4 h-4 shrink-0" />
      {hasAnalysis && (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#d51900] border border-white" />
      )}
    </button>
    <button
      type="button"
      title="Reviewer Annotations"
      onClick={onExpand}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
    >
      <PenLine className="w-4 h-4 shrink-0" />
      {hasAnnotations && (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#d51900] border border-white" />
      )}
    </button>
  </div>
);

// ─── Desktop panel (resizable + collapsible) ──────────────────────────────────

const DesktopPanel = (props: ReportDetailsPanelProps) => {
  const { isCollapsed, width, toggleCollapse, setWidth } = useSidebarState(
    'labelix-review-panel',
    { min: PANEL_MIN_WIDTH, max: PANEL_MAX_WIDTH, defaultWidth: 320, defaultCollapsed: true, forceClosedOnMount: true },
  );

  const panelRef     = useRef<HTMLElement>(null);
  const dragWidthRef = useRef<number>(width);
  const annotationsRef = useRef<HTMLDivElement>(null);

  const displayWidth = isCollapsed ? PANEL_COLLAPSED_WIDTH : width;

  const hasAnalysis = props.satisfiedItems.length > 0 || props.missingItems.length > 0 ||
    props.aiAnnotations.length > 0;
  const hasAnnotations = useMemo(
    () => new Set(props.annotations.map(a => a.groupId)).size > 0,
    [props.annotations],
  );

  // ── Resize drag — left edge, direct DOM mutation ──────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!panelRef.current) return;

      dragWidthRef.current = panelRef.current.getBoundingClientRect().width;
      panelRef.current.style.transition = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        const newWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, rect.right - ev.clientX));
        dragWidthRef.current = newWidth;
        panelRef.current.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        if (panelRef.current) panelRef.current.style.transition = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
        setWidth(dragWidthRef.current);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);
    },
    [setWidth],
  );

  return (
    <aside
      ref={panelRef as React.RefObject<HTMLElement>}
      className="relative shrink-0 bg-white border-l border-gray-200 flex flex-col transition-[width] duration-200 ease-in-out"
      style={{ width: displayWidth, height: '100%' }}
    >
      {/* ── Resize handle — left edge, expanded only ──────────────────── */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 opacity-0 hover:opacity-100 hover:bg-blue-400/50 active:bg-blue-500/60 transition-opacity"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* ── Collapse / expand toggle ───────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 rounded-full w-5 h-5 bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed
          ? <ChevronLeft  size={12} className="shrink-0" />
          : <ChevronRight size={12} className="shrink-0" />
        }
      </button>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isCollapsed ? (
          <CollapsedView
            hasAnalysis={hasAnalysis}
            hasAnnotations={hasAnnotations}
            onExpand={toggleCollapse}
          />
        ) : (
          <PanelContent {...props} annotationsRef={annotationsRef} />
        )}
      </div>
    </aside>
  );
};

// ─── Mobile drawer content ────────────────────────────────────────────────────

const MobileDrawerContent = (props: ReportDetailsPanelProps) => <PanelContent {...props} />;

// ─── Main export ──────────────────────────────────────────────────────────────

const ReportDetailsPanel = (props: ReportDetailsPanelProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const annotationCount = useMemo(
    () => new Set(props.annotations.map(a => a.groupId)).size,
    [props.annotations],
  );

  return (
    <>
      {/* Desktop: resizable right column (lg+) */}
      <div className="hidden lg:block h-full">
        <DesktopPanel {...props} />
      </div>

      {/* Mobile: floating button + slide-in drawer */}
      <div className="lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full px-3 py-2 text-xs font-semibold text-gray-700 hover:shadow-xl transition-shadow"
        >
          <ClipboardList className="w-3.5 h-3.5 text-gray-500" />
          Report Details
          {annotationCount > 0 && (
            <span className="bg-[#d51900] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ml-1">
              {annotationCount}
            </span>
          )}
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerOpen(false)} />
        )}

        <div
          className={`fixed right-0 top-0 h-full w-[320px] z-50 shadow-xl border-l border-gray-200 transition-transform duration-300 ${
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
              <MobileDrawerContent {...props} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportDetailsPanel;
