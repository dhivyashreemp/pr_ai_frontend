import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, ScanLine, Trash2, Pencil, X, Check, MapPin, Copy, Lock, ZoomIn, ZoomOut, RotateCcw, Maximize2, Hand } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import ProfileDropdown from '@/components/ProfileDropdown';
import StepIndicator from '@/components/StepIndicator';
import type { DrawnBox } from '@/report/types';
import type { RequirementBox } from '@/components/VisualDiffViewer';
import { pdfToImage, isPdfFile } from '@/lib/pdfToImage';
import LabelSidebar from '@/components/LabelSidebar';
import ReportDetailsPanel from '@/components/ReportDetailsPanel';
import { ThemeProvider } from '@/report/ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AnnotationType = 'Modified' | 'Added' | 'Deleted';
type AnnotationDisposition = 'Expected' | 'Unexpected';
type AnnotationElementType = 'Text' | 'Symbol' | 'Barcode' | 'DataMatrix' | 'Image';

interface UserAnnotation extends DrawnBox {
  target:  'base' | 'new';
  groupId: string;  // boxes with the same groupId share one table row / report entry
  elementType: AnnotationElementType;
  disposition: AnnotationDisposition;
}

const TYPE_COLORS: Record<AnnotationType, string> = {
  Modified: '#2563eb',
  Added:    '#16a34a',
  Deleted:  '#dc2626',
};

// ─────────────────────────────────────────────────────────────────────────────
// Drawable image panel
// ─────────────────────────────────────────────────────────────────────────────

interface DrawState {
  startX: number; startY: number;
  curX:   number; curY:   number;
}

interface PlacementDraft {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type ResizeHandle = 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw';

interface DrawableImagePanelProps {
  src: string;
  title: string;
  subtitle?: string;
  target: 'base' | 'new';
  aiBoxes: DrawnBox[];
  userBoxes: UserAnnotation[];
  isDrawingMode: boolean;
  activeGroupId: string | null;   // if set, drawing adds to this group
  onDrawComplete: (target: 'base' | 'new', box: { top: number; left: number; width: number; height: number }) => void;
  onDeleteBox: (id: string) => void;
  onDeleteAiBox?: (id: string) => void;
  onDuplicateBox?: (source: DrawnBox | UserAnnotation, pos: { top: number; left: number; width: number; height: number }, panelTarget: 'base' | 'new') => void;
  onAdjustAiBox?: (id: string, pos: { top: number; left: number; width: number; height: number }) => void;
  highlightedGroupId?: string | null;
  isReadOnly?: boolean;
  initialAiOverrides?: Record<string, { top: number; left: number;

    width: number; height: number }>;
  transformRef?: React.RefObject<any>;
  onTransformed?: (_: any, state: { scale: number; positionX: number; positionY: number }) => void;
  onExpand?: () => void;
}

function DrawableImagePanel({
  src, title, subtitle, target,
  aiBoxes, userBoxes, isDrawingMode, activeGroupId,
  onDrawComplete, onDeleteBox, onDeleteAiBox, onDuplicateBox, onAdjustAiBox,
  highlightedGroupId,
  isReadOnly = false,
  initialAiOverrides,
  transformRef,
  onTransformed,
  onExpand,
}: DrawableImagePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const localPanRef = useRef<any>(null);
  const panRef = transformRef ?? localPanRef;
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isActivePanDrag, setIsActivePanDrag] = useState(false);

  // Reset pan mode whenever edit mode is turned off
  useEffect(() => {
    if (!isDrawingMode) { setIsPanning(false); setIsActivePanDrag(false); }
  }, [isDrawingMode]);

  // Duplicate / selection state
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<DrawnBox | UserAnnotation | null>(null);
  const [ghostBox, setGhostBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null);

  // AI box drag / resize — initialise from persisted parent state so positions
  // survive switching away and back to this child.
  const [aiOverrides, setAiOverrides] = useState<Record<string, { top: number; left: number; width: number; height: number }>>(initialAiOverrides ?? {});
  const [activeDrag, setActiveDrag]   = useState<{
    type: 'move' | ResizeHandle;
    id: string;
    startCX: number; startCY: number;
    orig: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const latestDragPos = useRef<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!activeDrag) return;
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - activeDrag.startCX) / rect.width  * 100;
      const dy = (e.clientY - activeDrag.startCY) / rect.height * 100;
      const { top: ot, left: ol, width: ow, height: oh } = activeDrag.orig;
      let pos: { top: number; left: number; width: number; height: number };
      if (activeDrag.type === 'move') {
        pos = {
          top:    Math.max(0, Math.min(100 - oh, ot + dy)),
          left:   Math.max(0, Math.min(100 - ow, ol + dx)),
          width:  ow, height: oh,
        };
      } else {
        let top = ot, left = ol, width = ow, height = oh;
        if (activeDrag.type.includes('n')) { top = ot + dy; height = oh - dy; }
        if (activeDrag.type.includes('s')) { height = oh + dy; }
        if (activeDrag.type.includes('w')) { left = ol + dx; width  = ow - dx; }
        if (activeDrag.type.includes('e')) { width = ow + dx; }
        pos = {
          top:    Math.max(0, Math.min(100 - 2, top)),
          left:   Math.max(0, Math.min(100 - 2, left)),
          width:  Math.max(3, Math.min(100 - Math.max(0, left), width)),
          height: Math.max(3, Math.min(100 - Math.max(0, top),  height)),
        };
      }
      latestDragPos.current = pos;
      setAiOverrides(prev => ({ ...prev, [activeDrag.id]: pos }));
    };
    const onUp = () => {
      if (latestDragPos.current) onAdjustAiBox?.(activeDrag.id, latestDragPos.current);
      latestDragPos.current = null;
      setSelectedBoxId(activeDrag.id);
      setActiveDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, [activeDrag, onAdjustAiBox]);

  // Cancel placement or deselect on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (placing) { setPlacing(null); setGhostBox(null); setPlacementDraft(null); }
      else         { setSelectedBoxId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placing]);

  const toPercent = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(100, (clientX - rect.left)  / rect.width  * 100)),
      y: Math.max(0, Math.min(100, (clientY - rect.top)   / rect.height * 100)),
    };
  };

  const clampPlacement = useCallback((left: number, top: number, width: number, height: number) => ({
    left: Math.max(0, Math.min(100 - width, left)),
    top:  Math.max(0, Math.min(100 - height, top)),
    width,
    height,
  }), []);

  const buildPlacementBox = useCallback((draft: PlacementDraft, source: DrawnBox | UserAnnotation) => {
    const dx = draft.currentX - draft.startX;
    const dy = draft.currentY - draft.startY;
    const moved = Math.abs(dx) > 0.8 || Math.abs(dy) > 0.8;

    if (!moved) {
      return clampPlacement(
        draft.currentX - source.width / 2,
        draft.currentY - source.height / 2,
        source.width,
        source.height,
      );
    }

    return clampPlacement(
      Math.min(draft.startX, draft.currentX),
      Math.min(draft.startY, draft.currentY),
      Math.max(3, Math.abs(dx)),
      Math.max(3, Math.abs(dy)),
    );
  }, [clampPlacement]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) { setIsActivePanDrag(true); return; }
    if (!isDrawingMode || placing) return;
    // Don't intercept clicks on buttons (e.g. the red delete X)
    if ((e.target as HTMLElement).closest('button')) return;
    setSelectedBoxId(null);   // clear selection only when actually starting a draw
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toPercent(e.clientX, e.clientY);
    setDraw({ startX: x, startY: y, curX: x, curY: y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = toPercent(e.clientX, e.clientY);
    if (isDrawingMode && !isPanning) setCursorPos({ x, y });
    if (!draw) return;
    setDraw(d => d ? { ...d, curX: x, curY: y } : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsActivePanDrag(false);
    if (!draw) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const left   = Math.min(draw.startX, draw.curX);
    const top    = Math.min(draw.startY, draw.curY);
    const width  = Math.abs(draw.curX - draw.startX);
    const height = Math.abs(draw.curY - draw.startY);
    if (width > 2 && height > 2) {
      onDrawComplete(target, { top, left, width, height });
    }
    setDraw(null);
  };

  const liveRect = draw
    ? {
        left:   `${Math.min(draw.startX, draw.curX)}%`,
        top:    `${Math.min(draw.startY, draw.curY)}%`,
        width:  `${Math.abs(draw.curX - draw.startX)}%`,
        height: `${Math.abs(draw.curY - draw.startY)}%`,
      }
    : null;

  // Group user boxes so we can show index within group (e.g. "Use By Date ×2")
  const boxGroupCount: Record<string, number> = {};
  for (const b of userBoxes) boxGroupCount[b.groupId] = (boxGroupCount[b.groupId] ?? 0) + 1;
  const boxGroupIndex: Record<string, number> = {};

  return (
    <div className={`flex flex-col bg-white border border-gray-200 shadow-sm ${target === 'base' ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-[#d51900]'}`}>
      {/* Panel header */}
      <div
        className={`border-b-2 px-4 py-2 flex items-center justify-between ${target === 'base' ? 'bg-blue-50 border-b-blue-400' : 'bg-red-50 border-b-red-400'}`}
      >
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${target === 'base' ? 'bg-blue-500' : 'bg-[#d51900]'}`} />
            <div className={`text-sm font-semibold uppercase tracking-wide ${target === 'base' ? 'text-blue-700' : 'text-[#d51900]'}`}>{title}</div>
            {isReadOnly && (
              <div className="flex items-center gap-0.5 ml-1">
                <Lock className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400">View only</span>
              </div>
            )}
          </div>
          {subtitle && <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-xs">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {isDrawingMode && !isReadOnly && (
            <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 flex items-center gap-1 mr-1">
              <Pencil className="w-2.5 h-2.5" />
              {activeGroupId ? 'Adding location…' : 'Drawing active'}
            </span>
          )}
          <button onClick={() => panRef.current?.zoomIn(0.3)} className="p-1 hover:bg-black/10 rounded transition-colors" title="Zoom in"><ZoomIn className="h-3.5 w-3.5 text-gray-600" /></button>
          <button onClick={() => panRef.current?.zoomOut(0.3)} className="p-1 hover:bg-black/10 rounded transition-colors" title="Zoom out"><ZoomOut className="h-3.5 w-3.5 text-gray-600" /></button>
          <button onClick={() => panRef.current?.resetTransform()} className="p-1 hover:bg-black/10 rounded transition-colors" title="Reset zoom"><RotateCcw className="h-3.5 w-3.5 text-gray-600" /></button>
          <button
            onClick={() => setIsPanning(p => !p)}
            className={`p-1 rounded transition-colors ${isPanning ? 'bg-blue-100 ring-1 ring-blue-400' : 'hover:bg-black/10'}`}
            title={isPanning ? 'Pan mode ON — click to switch back to draw' : 'Pan mode — drag to move around the label'}
          >
            <Hand className={`h-3.5 w-3.5 ${isPanning ? 'text-blue-600' : 'text-gray-600'}`} />
          </button>
          {onExpand && (
            <button onClick={onExpand} className="p-1 hover:bg-black/10 rounded transition-colors" title="Expand to fullscreen">
              <Maximize2 className="h-3.5 w-3.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Image area */}
      <div className="relative overflow-hidden">
        <TransformWrapper
          ref={panRef}
          minScale={0.5}
          maxScale={4}
          initialScale={1}
          panning={{ disabled: placing ? true : !isPanning && (isDrawingMode || !!activeGroupId) }}
          wheel={{ step: 0.05 }}
          doubleClick={{ disabled: true }}
          onTransformed={onTransformed}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%' }}
            contentStyle={{ width: '100%' }}
          >
            <div
              ref={containerRef}
              className={`relative select-none w-full${isReadOnly ? ' pointer-events-none' : ''}`}
              style={{ cursor: isReadOnly ? 'default' : isPanning ? (isActivePanDrag ? 'grabbing' : 'grab') : isDrawingMode ? 'crosshair' : 'default' }}
              onPointerDown={isReadOnly ? undefined : handlePointerDown}
              onPointerMove={isReadOnly ? undefined : handlePointerMove}
              onPointerUp={isReadOnly ? undefined : handlePointerUp}
              onPointerLeave={() => { setCursorPos(null); setIsActivePanDrag(false); }}
              onClick={isReadOnly ? undefined : () => { if (!isDrawingMode && !placing) setSelectedBoxId(null); }}
            >
              <img src={src} alt={title} className="w-full h-auto block" draggable={false} />


              {/* Crosshair — only visible in drawing mode (hidden when pan mode is active) */}
              {isDrawingMode && !isPanning && !isReadOnly && cursorPos && (
                <>
                  <div style={{
                    position: 'absolute', top: `${cursorPos.y}%`, left: 0, right: 0,
                    height: 0, borderTop: '1px dashed rgba(60,60,60,0.6)',
                    pointerEvents: 'none', zIndex: 48,
                  }} />
                  <div style={{
                    position: 'absolute', left: `${cursorPos.x}%`, top: 0, bottom: 0,
                    width: 0, borderLeft: '1px dashed rgba(60,60,60,0.6)',
                    pointerEvents: 'none', zIndex: 48,
                  }} />
                </>
              )}

              {/* AI / requirement boxes — selectable, draggable, resizable */}
        {aiBoxes.map((box) => {
          const eff        = { ...box, ...(aiOverrides[box.id] ?? {}) };
          const color      = TYPE_COLORS[eff.type as AnnotationType] ?? '#6b7280';
          const isSelected = selectedBoxId === box.id;
          const isDragging = activeDrag?.id === box.id;
          const clickable  = !isDrawingMode && !placing;
          const HANDLES: { h: ResizeHandle; style: React.CSSProperties }[] = [
            { h: 'resize-nw', style: { top: -5,    left: -5              } },
            { h: 'resize-ne', style: { top: -5,    right: -5             } },
            { h: 'resize-se', style: { bottom: -5, right: -5             } },
            { h: 'resize-sw', style: { bottom: -5, left: -5              } },
          ];
          return (
            <div
              key={box.id}
              className={`absolute ${clickable ? '' : 'pointer-events-none'}`}
              style={{
                top:    `${eff.top}%`,
                left:   `${eff.left}%`,
                width:  `${eff.width}%`,
                height: `${eff.height}%`,
                border:          `2px dashed ${color}`,
                backgroundColor: `${color}18`,
                boxShadow:       isSelected ? `0 0 0 3px ${color}, 0 0 0 5px white` : undefined,
                zIndex:          isSelected ? 25 : undefined,
                cursor:          !clickable ? undefined : isDragging ? 'grabbing' : isSelected ? 'grab' : 'pointer',
                userSelect:      'none',
              }}
              onPointerDown={clickable ? (e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                if (isSelected && !placing) {
                  latestDragPos.current = null;
                  setActiveDrag({ type: 'move', id: box.id, startCX: e.clientX, startCY: e.clientY,
                    orig: { top: eff.top, left: eff.left, width: eff.width, height: eff.height } });
                }
              } : undefined}
              onClick={clickable ? (e) => {
                e.stopPropagation();
                if (!isDragging) setSelectedBoxId(isSelected ? null : box.id);
              } : undefined}
            >
              {/* Label tag — hidden while dragging to reduce clutter */}
              {!isDragging && (
                <span
                  className="absolute top-0 left-0 text-white px-1 leading-tight pointer-events-none"
                  style={{ fontSize: '7px', backgroundColor: color, transform: 'translateY(-100%)', whiteSpace: 'nowrap' }}
                >
                  {box.text || box.type}
                </span>
              )}

              {/* Corner resize handles */}
              {isSelected && !isDragging && HANDLES.map(({ h, style }) => (
                <div
                  key={h}
                  style={{
                    position: 'absolute', width: 10, height: 10,
                    background: 'white', border: `1.5px solid ${color}`,
                    zIndex: 26, cursor: `${h.replace('resize-', '')}-resize`,
                    ...style,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    latestDragPos.current = null;
                    setActiveDrag({ type: h, id: box.id, startCX: e.clientX, startCY: e.clientY,
                      orig: { top: eff.top, left: eff.left, width: eff.width, height: eff.height } });
                  }}
                />
              ))}

              {/* Toolbar — Duplicate + Deselect (hidden while dragging) */}
              {isSelected && !isDragging && (
                <div
                  style={{
                    position: 'absolute', bottom: -28, left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 2,
                    background: 'white', border: `1.5px solid ${color}`,
                    borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    padding: '2px 4px', zIndex: 30, whiteSpace: 'nowrap', pointerEvents: 'all',
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Duplicate — click or drag on the image to place a copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlacing(box);
                      setGhostBox(null);
                      setPlacementDraft(null);
                      setSelectedBoxId(null);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: 9, fontWeight: 700, fontFamily: 'sans-serif',
                      color, background: 'none', border: 'none',
                      cursor: 'pointer', padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <Copy style={{ width: 9, height: 9 }} /> Duplicate
                  </button>
                  <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                  <button
                    title="Delete this AI box"
                    onClick={(e) => { e.stopPropagation(); onDeleteAiBox?.(box.id); setSelectedBoxId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', color: '#ef4444',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 3px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <Trash2 style={{ width: 9, height: 9 }} />
                  </button>
                  <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                  <button
                    title="Deselect"
                    onClick={(e) => { e.stopPropagation(); setSelectedBoxId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', color: '#94a3b8',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 3px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* User-drawn boxes */}
        {userBoxes.map((box) => {
          const color = TYPE_COLORS[box.type as AnnotationType] ?? '#6b7280';
          boxGroupIndex[box.groupId] = (boxGroupIndex[box.groupId] ?? 0) + 1;
          const idx   = boxGroupIndex[box.groupId];
          const total = boxGroupCount[box.groupId];
          const isHighlighted = activeGroupId === box.groupId || highlightedGroupId === box.groupId;
          const isSelected    = selectedBoxId === box.id;
          const clickable     = !isDrawingMode && !placing;
          return (
            <div
              key={box.id}
              className={`absolute group ${clickable ? 'cursor-pointer' : ''}`}
              style={{
                top:    `${box.top}%`,
                left:   `${box.left}%`,
                width:  `${box.width}%`,
                height: `${box.height}%`,
                border:          `2px solid ${color}`,
                backgroundColor: isHighlighted ? `${color}30` : `${color}18`,
                outline:         isHighlighted ? `2px solid ${color}` : undefined,
                outlineOffset:   isHighlighted ? '2px' : undefined,
                boxShadow:       isSelected ? `0 0 0 3px ${color}, 0 0 0 5px white` : undefined,
                zIndex:          isSelected ? 25 : undefined,
              }}
              onPointerDown={clickable ? (e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); } : undefined}
              onClick={clickable ? (e) => { e.stopPropagation(); setSelectedBoxId(isSelected ? null : box.id); } : undefined}
            >
              <span
                className="absolute top-0 left-0 text-white px-1 leading-tight whitespace-nowrap"
                style={{ fontSize: '7px', backgroundColor: color, transform: 'translateY(-100%)' }}
              >
                {box.text || box.type}{total > 1 ? ` (${idx}/${total})` : ''}
              </span>
              {/* Delete button (hover) */}
              <button
                className="absolute top-0 right-0 bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                style={{ fontSize: '8px', transform: 'translate(50%, -50%)' }}
                onClick={(e) => { e.stopPropagation(); onDeleteBox(box.id); }}
                title="Remove this box"
              >
                <X className="w-2.5 h-2.5" />
              </button>
              {/* Duplicate toolbar (visible when selected) */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute', bottom: -28, left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 2,
                    background: 'white', border: `1.5px solid ${color}`,
                    borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    padding: '2px 4px', zIndex: 30, whiteSpace: 'nowrap', pointerEvents: 'all',
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Duplicate — click or drag on the image to place a copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlacing(box);
                      setGhostBox(null);
                      setPlacementDraft(null);
                      setSelectedBoxId(null);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: 9, fontWeight: 700, fontFamily: 'sans-serif',
                      color, background: 'none', border: 'none',
                      cursor: 'pointer', padding: '2px 4px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <Copy style={{ width: 9, height: 9 }} /> Duplicate
                  </button>
                  <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                  <button
                    title="Delete this box"
                    onClick={(e) => { e.stopPropagation(); onDeleteBox(box.id); setSelectedBoxId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', color: '#ef4444',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 3px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <Trash2 style={{ width: 9, height: 9 }} />
                  </button>
                  <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                  <button
                    title="Deselect"
                    onClick={(e) => { e.stopPropagation(); setSelectedBoxId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', color: '#94a3b8',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 3px', borderRadius: 3, lineHeight: 1,
                    }}
                  >
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Live drawing rectangle */}
        {liveRect && (
          <div
            className="absolute pointer-events-none border-2 border-dashed border-blue-500"
            style={{ ...liveRect, backgroundColor: 'rgba(59, 130, 246, 0.10)' }}
          />
        )}

        {/* Placement overlay — captures click to drop the duplicate */}
        {placing && (
          <div
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 50 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) { setPlacing(null); setGhostBox(null); setPlacementDraft(null); return; }
              if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                setPlacing(null);
                setGhostBox(null);
                setPlacementDraft(null);
                return;
              }
              e.currentTarget.setPointerCapture(e.pointerId);
              const { x, y } = toPercent(e.clientX, e.clientY);
              const draft = { startX: x, startY: y, currentX: x, currentY: y };
              setPlacementDraft(draft);
              setGhostBox(buildPlacementBox(draft, placing));
            }}
            onPointerUp={(e)   => {
              e.stopPropagation();
              e.preventDefault();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) { setPlacing(null); setGhostBox(null); setPlacementDraft(null); return; }
              const { x, y } = toPercent(e.clientX, e.clientY);
              const draft = placementDraft
                ? { ...placementDraft, currentX: x, currentY: y }
                : { startX: x, startY: y, currentX: x, currentY: y };
              onDuplicateBox?.(placing, buildPlacementBox(draft, placing), target);
              setPlacing(null);
              setGhostBox(null);
              setPlacementDraft(null);
            }}
            onPointerMove={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const { x, y } = toPercent(e.clientX, e.clientY);
              const draft = placementDraft
                ? { ...placementDraft, currentX: x, currentY: y }
                : { startX: x, startY: y, currentX: x, currentY: y };
              if (placementDraft) setPlacementDraft(draft);
              setGhostBox(buildPlacementBox(draft, placing));
            }}
          >
            <div style={{
              position: 'absolute', top: 8, left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.82)', color: 'white',
              fontSize: 10, fontWeight: 700, fontFamily: 'sans-serif',
              padding: '5px 12px', borderRadius: 5,
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap', pointerEvents: 'none',
              boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
            }}>
              <Copy style={{ width: 10, height: 10 }} />
              Click to place "{((placing.text || placing.type) as string).length > 22
                ? ((placing.text || placing.type) as string).slice(0, 22) + '…'
                : (placing.text || placing.type)}"
              <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: 3 }}>· Esc to cancel</span>
            </div>
          </div>
        )}

        {/* Ghost box preview */}
        {placing && ghostBox && (
          <div
            style={{
              position: 'absolute',
              top:    `${ghostBox.top}%`,
              left:   `${ghostBox.left}%`,
              width:  `${ghostBox.width}%`,
              height: `${ghostBox.height}%`,
              border:          `2px dashed ${TYPE_COLORS[placing.type as AnnotationType] ?? '#6b7280'}`,
              backgroundColor: `${TYPE_COLORS[placing.type as AnnotationType] ?? '#6b7280'}25`,
              pointerEvents:   'none',
              zIndex: 49,
            }}
          />
        )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotation comment dialog (appears after drawing the FIRST box in a group)
// ─────────────────────────────────────────────────────────────────────────────

interface PendingBox {
  target: 'base' | 'new';
  top: number; left: number; width: number; height: number;
}

interface AnnotationDialogProps {
  pending: PendingBox;
  onSave:   (payload: { comment: string; type: AnnotationType; elementType: AnnotationElementType; disposition: AnnotationDisposition }) => void;
  onCancel: () => void;
}

function AnnotationDialog({ pending, onSave, onCancel }: AnnotationDialogProps) {
  const [comment, setComment] = useState('');
  const [type,    setType]    = useState<AnnotationType | null>(null);
  const [elementType, setElementType] = useState<AnnotationElementType>('Text');
  const [disposition, setDisposition] = useState<AnnotationDisposition | null>(null);

  const ELEMENT_TYPES: AnnotationElementType[] = ['Text', 'Symbol', 'Barcode', 'DataMatrix', 'Image'];

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl border border-gray-200 w-full max-w-sm">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">Add Annotation</span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Change type selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Change Type
            </label>
            <div className="flex gap-2">
              {(['Modified', 'Added', 'Deleted'] as AnnotationType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex-1 py-1.5 text-xs font-semibold border transition-colors"
                  style={
                    type === t
                      ? { backgroundColor: TYPE_COLORS[t], color: '#fff', borderColor: TYPE_COLORS[t] }
                      : { backgroundColor: '#f8f8f8', color: '#6b7280', borderColor: '#d1d5db' }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Comment field */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Comment / Description
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe what you observed…"
              rows={3}
              className="w-full border border-gray-300 text-xs px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Element Type
            </label>
            <select
              value={elementType}
              onChange={(e) => setElementType(e.target.value as AnnotationElementType)}
              className="w-full border border-gray-300 text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 bg-white"
            >
              {ELEMENT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Report Section
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Expected', 'Unexpected'] as AnnotationDisposition[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setDisposition(item)}
                  className="py-2 text-xs font-semibold border transition-colors"
                  style={
                    disposition === item
                      ? { backgroundColor: item === 'Expected' ? '#0f766e' : '#9a3412', color: '#fff', borderColor: item === 'Expected' ? '#0f766e' : '#9a3412' }
                      : { backgroundColor: '#f8f8f8', color: '#6b7280', borderColor: '#d1d5db' }
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-3 py-2 text-[10px] text-blue-700">
            <strong>Tip:</strong> After saving, use <strong>Add Location</strong> on the annotation row to place more boxes for the same change — they&apos;ll share a single report entry and stay linked in the report.
          </div>

          <div className="text-[10px] text-gray-400">
            Annotating: <span className="font-semibold text-gray-600">
              {pending.target === 'base' ? 'Current Version' : 'New Version'}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (comment.trim() && type && disposition) onSave({ comment: comment.trim(), type, elementType, disposition });
            }}
            disabled={!comment.trim() || !type || !disposition}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#D71500] hover:bg-[#b01300] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Preview Page
// ─────────────────────────────────────────────────────────────────────────────

const PreviewPage = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const state      = location.state ?? {};
  const formData   = state.formData;

  // ── Restore image URLs from File objects ─────────────────────────────────
  const baseFileArr:  File[] = state.originalBaseFiles ?? state.baseFile  ?? [];
  const childFileArr: File[] = state.originalChildFiles ?? state.childFile ?? [];
  const [baseUrl,  setBaseUrl]  = useState('');
  const [childUrl, setChildUrl] = useState('');

  useEffect(() => {
    const file = baseFileArr[0];
    if (!file) {
      setBaseUrl('');
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        if (isPdfFile(file)) {
          const dataUrl = await pdfToImage(file);
          if (!cancelled) setBaseUrl(dataUrl);
        } else {
          blobUrl = URL.createObjectURL(file);
          if (!cancelled) setBaseUrl(blobUrl);
        }
      } catch (e) {
        console.error('Failed to build base preview:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [baseFileArr[0]]);

  useEffect(() => {
    const file = childFileArr[0];
    if (!file) {
      setChildUrl('');
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        if (isPdfFile(file)) {
          const dataUrl = await pdfToImage(file);
          if (!cancelled) setChildUrl(dataUrl);
        } else {
          blobUrl = URL.createObjectURL(file);
          if (!cancelled) setChildUrl(blobUrl);
        }
      } catch (e) {
        console.error('Failed to build child preview:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [childFileArr[0]]);

  const baseFileName  = state.baseFileName  ?? (baseFileArr[0]?.name  ?? '');
  const childFileName = state.childFileName ?? (childFileArr[0]?.name ?? '');

  // ── Multi-child sidebar state ────────────────────────────────────────────
  const expandedChildPreviewUrls: string[] = state.expandedChildPreviewUrls ?? [];
  const expandedBasePreviewUrls:  string[] = state.expandedBasePreviewUrls  ?? [];
  const expandedBaseFileNames:    string[] = state.expandedBaseFileNames    ?? [];
  const originalBaseNames:        string[] = state.originalBaseNames        ?? [];
  const originalChildNames:       string[] = state.originalChildNames       ?? [];
  const childFilesAll: File[] = state.childFiles ?? [];
  // Per-label ref numbers extracted by backend OCR — used to rename pages and header SKU
  const allLabelSkus: string[] = state.allLabelSkus ?? [];

  // Helper: when the original file was a PDF, return the per-page expanded name
  // with a .pdf extension so the UI shows "LCN_page1.pdf" instead of "LCN_page1.png".
  const pdfPageName = (expanded: string | undefined, original: string | undefined): string =>
    expanded && original && /\.pdf$/i.test(original)
      ? expanded.replace(/\.png$/i, '.pdf')
      : (expanded ?? original ?? '');

  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(state.selectedResultIndex ?? 0);

  // ── Build existing AI / requirement boxes for overlay ────────────────────
  const annotations:      any[]            = state.annotations     ?? [];
  const requirementBoxes: RequirementBox[] = state.requirementBoxes ?? [];

  // Per-child deleted discrepancy ID sets — keyed by child index so deletions
  // on one label never bleed into another. Seeded from the per-child map passed
  // by Index.tsx (allDeletedDiscrepancyIdsByChild) and grows as the user deletes
  // more boxes here.  Used when navigating back so the analysis page restores
  // the same deleted state per label.
  const [deletedDiscrepancyIdsByChildPreview, setDeletedDiscrepancyIdsByChildPreview] = useState<Record<number, Set<number | string>>>(
    () => {
      const childMap = state.allDeletedDiscrepancyIdsByChild as Record<string, (number | string)[]> | undefined;
      if (childMap && Object.keys(childMap).length > 0) {
        return Object.fromEntries(Object.entries(childMap).map(([k, v]) => [Number(k), new Set(v)]));
      }
      const initIdx = state.selectedResultIndex ?? 0;
      return { [initIdx]: new Set(state.deletedDiscrepancyIds ?? []) };
    }
  );

  // Helper: for a given annotation list + deleted-ID set, return the
  // 'annotation-N' IDs that should be hidden on the canvas.
  const deriveHiddenIds = (anns: any[], deletedSet: Set<number | string>): string[] =>
    anns
      .map((ann: any, i: number) =>
        ann.discrepancy_id != null && deletedSet.has(ann.discrepancy_id)
          ? `annotation-${i}` : null
      )
      .filter(Boolean) as string[];

  // Per-child hidden AI box IDs — keyed by child index so deletions on one
  // label are not lost when switching to another and back.
  const [hiddenAiBoxIdsByChild, setHiddenAiBoxIdsByChild] = useState<Record<number, string[]>>(
    () => {
      const idx = state.selectedResultIndex ?? 0;
      const initDeletedSet = (() => {
        const childMap = state.allDeletedDiscrepancyIdsByChild as Record<string, (number | string)[]> | undefined;
        if (childMap?.[String(idx)]) return new Set<number | string>(childMap[String(idx)]);
        return new Set<number | string>(state.deletedDiscrepancyIds ?? []);
      })();
      return { [idx]: deriveHiddenIds(state.annotations ?? [], initDeletedSet) };
    }
  );
  const hiddenAiBoxIds = hiddenAiBoxIdsByChild[selectedChildIndex] ?? [];

  // When the user picks a different child in the sidebar, show that child's
  // AI annotations. Prefer the per-child adjusted arrays passed from Index.tsx
  // (which already have bbox deletions applied) so deleted boxes never reappear.
  // Fall back to the originally-passed annotations for the active child, then to
  // raw API results for children that were never modified.
  const activeAnnotations: any[] = (() => {
    const allAdjusted = state.allAdjustedAnnotations as Record<string, any[]> | undefined;
    if (allAdjusted?.[selectedChildIndex] != null) return allAdjusted[selectedChildIndex];
    return state.allProcessedAnnotations?.[selectedChildIndex] ?? 
      (selectedChildIndex === (state.selectedResultIndex ?? 0) ? annotations : (state.apiResults?.[selectedChildIndex]?.annotations ?? []));
  })();

  // Requirement boxes only apply to the originally-selected child (they are
  // pre-computed by Index.tsx for that specific child). For other children
  // we only show the raw AI annotations.
  const activeRequirementBoxes: RequirementBox[] =
    state.allProcessedRequirementBoxes?.[selectedChildIndex] ?? 
    (selectedChildIndex === (state.selectedResultIndex ?? 0) ? requirementBoxes : []);

  // Compute parsedItems for the active child, ensuring we only include items
  // that have a localized bbox in the VisualDiffViewer, exactly matching
  // the behaviour of DataTables in Index.tsx.
  const activeParsedItems: any[] = (() => {
    const items = state?.allProcessedParsedItems?.[selectedChildIndex] ?? 
      (selectedChildIndex === (state?.selectedResultIndex ?? 0)
        ? (state?.parsedItems ?? [])
        : (state?.apiResults?.[selectedChildIndex]?.parsedItems ?? []));
    
    // Fallback to the active page's bbox IDs if the per-child arrays aren't present
    let validIds: Set<number | string>;
    if (state.allProcessedBboxIds?.[selectedChildIndex]) {
      validIds = new Set(state.allProcessedBboxIds[selectedChildIndex]);
    } else {
      validIds = new Set(state.bboxDiscrepancyIds ?? []);
    }
    
    return items.filter((item: any) => validIds.has(item.discrepancy_id));
  })();

  // ── Discard state for unexpected changes ────────────────────────────────
  const [discardedUnexpectedIds, setDiscardedUnexpectedIds] = useState<Set<string>>(
    new Set(location.state?.discardedUnexpectedIds ?? [])
  );
  const handleDiscard = (id: string) => {
    setDiscardedUnexpectedIds(prev => new Set([...prev, id]));

    let discrepancyId: number | string | undefined;
    if (id.startsWith('ai-')) {
      const idx = parseInt(id.slice(3), 10);
      discrepancyId = activeAnnotations[idx]?.discrepancy_id;
    } else if (id.startsWith('parsed-')) {
      const parsedId = id.slice(7);
      const parsedItem = activeParsedItems.find((pi: any) => pi.id == parsedId) 
                      || activeParsedItems[parseInt(parsedId, 10)];
      discrepancyId = parsedItem?.discrepancy_id;
    }

    if (discrepancyId != null) {
      setDeletedDiscrepancyIdsByChildPreview(prev => {
        const current = prev[selectedChildIndex] ?? new Set<number | string>();
        return { ...prev, [selectedChildIndex]: new Set([...current, discrepancyId!]) };
      });
    }
  };

  // Convert discarded panel IDs (ai-N) → canvas box IDs (annotation-N) so
  // discarded items are hidden from the overlay without touching hiddenAiBoxIds.
  const discardedAnnotationBoxIds = useMemo(
    () => [...discardedUnexpectedIds]
      .filter(id => id.startsWith('ai-'))
      .map(id => `annotation-${id.slice(3)}`),
    [discardedUnexpectedIds],
  );

  const existingNewBoxes: DrawnBox[] = useMemo(() => {
    // LRF requirement boxes (0-1 normalized coords → convert to %)
    // Color matches VisualDiffViewer: satisfied → green (Added), missing → red (Deleted)
    const reqBoxes: DrawnBox[] = activeRequirementBoxes
      .map((b: RequirementBox, i: number) => ({
        id:     `requirement-${i}`,
        type:   (b.satisfied === true  ? 'Added'
               : b.satisfied === false ? 'Deleted'
               : b.changeType === 'Added'   || b.changeType === 'Add'    ? 'Added'
               : b.changeType === 'Deleted' || b.changeType === 'Remove' ? 'Deleted'
               : 'Modified') as DrawnBox['type'],
        top:    b.y      * 100,
        left:   b.x      * 100,
        width:  b.width  * 100,
        height: b.height * 100,
        text:   b.label ?? '',
      }))
      .filter(box => !hiddenAiBoxIds.includes(box.id));

    const reqBoxKeys = new Set(reqBoxes.map(b => `${b.left.toFixed(3)},${b.top.toFixed(3)},${b.width.toFixed(3)},${b.height.toFixed(3)}`));
    
    // Only apply expected discrepancy filtering to the originally selected child,
    // as parsedItems and requirementBoxes are only valid for that specific child.
    const expectedDiscrepancyIds = new Set(
      (state.allProcessedParsedItems?.[selectedChildIndex] ?? 
      (selectedChildIndex === (state.selectedResultIndex ?? 0) ? (state.parsedItems ?? []) : []))
        .filter((pi: any) => pi.isValid === true && pi.discrepancy_id != null)
        .map((pi: any) => pi.discrepancy_id)
    );

    // Comparator AI annotation boxes
    const annotationAiBoxes = activeAnnotations.map((b: any, i: number) => ({
      id:     `annotation-${i}`,
      type:   (b.change_type ?? 'Modified') as DrawnBox['type'],
      top:    (b.y ?? b.top ?? 0) * (b.y !== undefined ? 100 : 1),
      left:   (b.x ?? b.left ?? 0) * (b.x !== undefined ? 100 : 1),
      width:  (b.width ?? 0) * ((b.width ?? 0) <= 1 ? 100 : 1),
      height: (b.height ?? 0) * ((b.height ?? 0) <= 1 ? 100 : 1),
      text:   b.label ?? b.text ?? '',
      discrepancy_id: b.discrepancy_id,
      category: b.category,
      confidence: b.confidence,
    })).filter(
      box => {
        if (hiddenAiBoxIds.includes(box.id) || discardedAnnotationBoxIds.includes(box.id)) return false;
        if (box.discrepancy_id != null && expectedDiscrepancyIds.has(box.discrepancy_id)) return false;
        const key = `${box.left.toFixed(3)},${box.top.toFixed(3)},${box.width.toFixed(3)},${box.height.toFixed(3)}`;
        if (reqBoxKeys.has(key)) return false;
        
        // Hide standalone ZXing barcodes that aren't tied to a discrepancy, as they
        // are only passed for snap-to-box purposes in the Analysis Page.
        if (box.discrepancy_id == null && (box.category === 'Barcode' || box.category === 'DataMatrix')) {
          return false;
        }

        return true;
      }
    );

    return [...annotationAiBoxes, ...reqBoxes];
  }, [activeAnnotations, activeRequirementBoxes, hiddenAiBoxIds, discardedAnnotationBoxIds, state.parsedItems]);

  // ── AI box position adjustments (human-in-the-loop fine-tuning) ─────────
  // Keyed by child index so each child retains its own independent adjustments.
  const [aiBoxAdjustments, setAiBoxAdjustments] = useState<Record<number, Record<string, { top: number; left: number; width: number; height: number }>>>({});

  const handleAdjustAiBox = useCallback((id: string, pos: { top: number; left: number; width: number; height: number }) => {
    setAiBoxAdjustments(prev => ({
      ...prev,
      [selectedChildIndex]: { ...(prev[selectedChildIndex] ?? {}), [id]: pos },
    }));
  }, [selectedChildIndex]);

  const handleDeleteAiBox = useCallback((id: string) => {
    setHiddenAiBoxIdsByChild(prev => {
      const current = prev[selectedChildIndex] ?? [];
      if (current.includes(id)) return prev;
      return { ...prev, [selectedChildIndex]: [...current, id] };
    });
    // Track the discrepancy_id per-child so deletions on one label don't affect others
    const idx = parseInt(id.replace('annotation-', ''), 10);
    if (!isNaN(idx)) {
      const discrepancyId = activeAnnotations[idx]?.discrepancy_id;
      if (discrepancyId != null) {
        setDeletedDiscrepancyIdsByChildPreview(prev => {
          const current = prev[selectedChildIndex] ?? new Set<number | string>();
          return { ...prev, [selectedChildIndex]: new Set([...current, discrepancyId]) };
        });
      }
    }
  }, [activeAnnotations, selectedChildIndex]);

  // ── User-drawn annotation state (per-child) ─────────────────────────────
  const [userAnnotationsByChild, setUserAnnotationsByChild] = useState<Record<number, UserAnnotation[]>>(
    { [state.selectedResultIndex ?? 0]: state.userAnnotations ?? [] }
  );
  const userAnnotations = userAnnotationsByChild[selectedChildIndex] ?? [];
  const setUserAnnotations = useCallback(
    (updater: ((prev: UserAnnotation[]) => UserAnnotation[]) | UserAnnotation[]) => {
      setUserAnnotationsByChild(byChild => ({
        ...byChild,
        [selectedChildIndex]: typeof updater === 'function'
          ? updater(byChild[selectedChildIndex] ?? [])
          : updater,
      }));
    },
    [selectedChildIndex],
  );
  const [isDrawingMode,   setIsDrawingMode]   = useState(false);
  const [pendingBox,      setPendingBox]       = useState<PendingBox | null>(null);

  // Synchronized zoom/pan between base and new panels
  const basePanRef   = useRef<any>(null);
  const newPanRef    = useRef<any>(null);
  const isSyncing    = useRef(false);
  const handleBaseTransformed = useCallback((_: any, s: { scale: number; positionX: number; positionY: number }) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    newPanRef.current?.setTransform(s.positionX, s.positionY, s.scale, 0);
    setTimeout(() => { isSyncing.current = false; }, 0);
  }, []);
  const handleNewTransformed = useCallback((_: any, s: { scale: number; positionX: number; positionY: number }) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    basePanRef.current?.setTransform(s.positionX, s.positionY, s.scale, 0);
    setTimeout(() => { isSyncing.current = false; }, 0);
  }, []);

  // Expanded fullscreen modal state and synchronized zoom refs
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedBasePanRef = useRef<any>(null);
  const expandedNewPanRef  = useRef<any>(null);
  const isExpandedSyncing  = useRef(false);
  const handleExpandedBaseTransformed = useCallback((_: any, s: { scale: number; positionX: number; positionY: number }) => {
    if (isExpandedSyncing.current) return;
    isExpandedSyncing.current = true;
    expandedNewPanRef.current?.setTransform(s.positionX, s.positionY, s.scale, 0);
    setTimeout(() => { isExpandedSyncing.current = false; }, 0);
  }, []);
  const handleExpandedNewTransformed = useCallback((_: any, s: { scale: number; positionX: number; positionY: number }) => {
    if (isExpandedSyncing.current) return;
    isExpandedSyncing.current = true;
    expandedBasePanRef.current?.setTransform(s.positionX, s.positionY, s.scale, 0);
    setTimeout(() => { isExpandedSyncing.current = false; }, 0);
  }, []);

  // Close expanded modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isExpanded]);

  /**
   * When set, the next draw will add to an EXISTING annotation group
   * (bypasses the dialog — type + comment are inherited from the group).
   */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);


  const handleExitAddLocation = () => {
    setActiveGroupId(null);
    setIsDrawingMode(false);
  };

  const handleDrawComplete = useCallback(
    (target: 'base' | 'new', box: { top: number; left: number; width: number; height: number }) => {
      if (activeGroupId) {
        // Add a new box to the existing group — no dialog needed
        setUserAnnotations(prev => {
          const leader = prev.find(a => a.groupId === activeGroupId);
          if (!leader) return prev;
          return [...prev, {
            id:      `user-${Date.now()}`,
            type:    leader.type,
            top:     box.top,
            left:    box.left,
            width:   box.width,
            height:  box.height,
            text:    leader.text,
            target,
            groupId: activeGroupId,
            elementType: leader.elementType,
            disposition: leader.disposition,
          }];
        });
        // Edit mode stays on so user can keep adding locations
      } else {
        // Normal first-box flow — open dialog
        setPendingBox({ target, ...box });
      }
    },
    [activeGroupId],
  );

  const handleSaveAnnotation = ({
    comment,
    type,
    elementType,
    disposition,
  }: {
    comment: string;
    type: AnnotationType;
    elementType: AnnotationElementType;
    disposition: AnnotationDisposition;
  }) => {
    if (!pendingBox) return;
    const groupId = `grp-${Date.now()}`;
    const newBox: UserAnnotation = {
      id:     `user-${Date.now()}`,
      type,
      top:    pendingBox.top,
      left:   pendingBox.left,
      width:  pendingBox.width,
      height: pendingBox.height,
      text:   comment,
      target: pendingBox.target,
      groupId,
      elementType,
      disposition,
    };
    setUserAnnotations(prev => [...prev, newBox]);
    setPendingBox(null);
    // Edit mode stays on
  };

  const handleDeleteBox = (id: string) => {
    setUserAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleDuplicateBox = useCallback(
    (source: DrawnBox | UserAnnotation, pos: { top: number; left: number; width: number; height: number }, panelTarget: 'base' | 'new') => {
      const isUserAnn = 'groupId' in source;
      const newBox: UserAnnotation = {
        id:      `user-${Date.now()}`,
        type:    source.type as AnnotationType,
        top:     pos.top,
        left:    pos.left,
        width:   pos.width,
        height:  pos.height,
        text:    (source.text || source.type) as string,
        target:  panelTarget,
        // User annotation → same group (adds location); AI box → new group
        groupId: isUserAnn ? (source as UserAnnotation).groupId : `grp-${Date.now()}`,
        elementType: isUserAnn ? (source as UserAnnotation).elementType : 'Text',
        disposition: isUserAnn ? (source as UserAnnotation).disposition : 'Unexpected',
      };
      setUserAnnotations(prev => [...prev, newBox]);
    },
    [],
  );

  const handleDeleteGroup = (groupId: string) => {
    setUserAnnotations(prev => prev.filter(a => a.groupId !== groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
      setIsDrawingMode(false);
    }
  };

  // Group annotations for the table
  const annotationGroups = useMemo(() => {
    const map = new Map<string, UserAnnotation[]>();
    for (const ann of userAnnotations) {
      const arr = map.get(ann.groupId) ?? [];
      arr.push(ann);
      map.set(ann.groupId, arr);
    }
    return Array.from(map.entries()).map(([groupId, boxes]) => ({
      groupId,
      boxes,
      type:    boxes[0].type  as AnnotationType,
      text:    boxes[0].text  ?? '',
      elementType: boxes[0].elementType,
      disposition: boxes[0].disposition,
      targets: [...new Set(boxes.map(b => b.target))],
    }));
  }, [userAnnotations]);

  // Prefer the pre-rendered URL for the selected child (survives navigation);
  // fall back to the URL built from childFileArr[0] for the no-sidebar path.
  const activeChildUrl = expandedChildPreviewUrls[selectedChildIndex] || childUrl;
  // Fall back to index 0 when fewer base labels were uploaded than child labels
  // (e.g. 1 base vs N children — the single base is shown alongside every child).
  const activeBaseUrl  = expandedBasePreviewUrls[selectedChildIndex] || expandedBasePreviewUrls[0] || baseUrl;
  // Corresponding base label filename for the panel subtitle.
  // Prefer the per-page expanded name with .pdf extension so each child shows
  // its correct page (e.g. "LCN_page2.pdf") rather than the bare original PDF name.
  const activeBaseFileName = pdfPageName(
    expandedBaseFileNames[selectedChildIndex] || expandedBaseFileNames[0],
    originalBaseNames[selectedChildIndex]     || originalBaseNames[0]     || baseFileName,
  );
  const hasBase = !!activeBaseUrl;
  const hasNew  = !!activeChildUrl;

  // Subtitle shown in the "New Version" panel header — same .pdf extension fix.
  const activeChildFileName =
    allLabelSkus[selectedChildIndex] ||
    pdfPageName(
      childFilesAll[selectedChildIndex]?.name,
      originalChildNames[selectedChildIndex] || childFileName,
    );

  const userBaseBoxes = userAnnotations.filter(a => a.target === 'base');
  const userNewBoxes  = userAnnotations.filter(a => a.target === 'new');

  // ── Child switching ──────────────────────────────────────────────────────
  const handleSelectChild = useCallback((index: number) => {
    setSelectedChildIndex(index);
    // If this child was already visited, its hidden IDs are preserved in the map — don't
    // re-derive, otherwise manually-deleted boxes (those without a discrepancy_id) would
    // reappear on return. Only initialise on the very first visit to a child.
    setHiddenAiBoxIdsByChild(prev => {
      if (index in prev) return prev; // already initialised — keep as-is
      // Use adjusted annotations (already filtered) when available; no hidden IDs needed
      // since the deleted boxes are simply absent. Fall back to raw + derive for others.
      const allAdjusted = state.allAdjustedAnnotations as Record<string, any[]> | undefined;
      if (allAdjusted?.[index] != null) {
        return { ...prev, [index]: [] };
      }
      const childAnnotations: any[] =
        index === (state.selectedResultIndex ?? 0)
          ? (state.annotations ?? [])
          : (state.apiResults?.[index]?.annotations ?? []);
      // Use this child's own deletion set — not a global one — to avoid cross-child bleed
      const childDeletedSet = deletedDiscrepancyIdsByChildPreview[index] ?? new Set<number | string>();
      return { ...prev, [index]: deriveHiddenIds(childAnnotations, childDeletedSet) };
    });
    // aiBoxAdjustments is per-child — each child retains its own adjustments
  }, [deletedDiscrepancyIdsByChildPreview, state]);

  // ── Annotations panel hover / select state ───────────────────────────────
  const [hoveredAnnotationId,  setHoveredAnnotationId]  = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const handleHoverAnnotation  = useCallback((id: string | null) => setHoveredAnnotationId(id),  []);
  const handleSelectAnnotation = useCallback((id: string | null) => setSelectedAnnotationId(id), []);

  // ── Navigate to report ───────────────────────────────────────────────────
  const handleGenerateReport = () => {
    // All boxes → visual overlay on images
    const userAnnotationsBase = userAnnotations.filter(a => a.target === 'base');
    const userAnnotationsNew  = userAnnotations.filter(a => a.target === 'new');

    // One entry per unique group → report tables
    const seen = new Set<string>();
    const userAnnotationsUnique = userAnnotations.filter(a => {
      if (seen.has(a.groupId)) return false;
      seen.add(a.groupId);
      return true;
    });
    const userExpectedUnique = userAnnotationsUnique.filter(a => a.disposition === 'Expected');
    const userUnexpectedUnique = userAnnotationsUnique.filter(a => a.disposition !== 'Expected');

    // Merge human-adjusted positions back into requirementBoxes (% → 0-1 range)
    const childAdjustments = aiBoxAdjustments[selectedChildIndex] ?? {};
    const adjustedRequirementBoxes = (state.requirementBoxes ?? [])
      .filter((_: any, i: number) => !hiddenAiBoxIds.includes(`requirement-${i}`))
      .map((b: any) => {
        const originalIndex = requirementBoxes.indexOf(b);
        const adj = childAdjustments[`requirement-${originalIndex}`];
        if (!adj) return b;
        return { ...b, y: adj.top / 100, x: adj.left / 100, width: adj.width / 100, height: adj.height / 100 };
      });

    const adjustedAnnotations = (activeAnnotations ?? [])
      .filter((_: any, i: number) => !hiddenAiBoxIds.includes(`annotation-${i}`))
      .map((b: any, i: number) => {
        const adj = childAdjustments[`annotation-${i}`];
        if (!adj) return b;
        return {
          ...b,
          y: adj.top / 100,
          x: adj.left / 100,
          width: adj.width / 100,
          height: adj.height / 100,
        };
      });

    // A label is considered "changed" only when:
    //   • the user drew at least one annotation on the preview page, OR
    //   • at least one proof-request requirement was actually SATISFIED (found on the label), OR
    //   • there are any requirements at all (even all-Mismatch) — these still need the full
    //     3-page FrameC report, NOT the FrameNoChange template.
    //
    // Only when there are zero requirements AND zero annotations does the report
    // render the No Change template (Scenario A with truly no detected changes).
    const satisfiedCount    = (state.satisfiedItems?.length ?? 0);
    const hasRequirements   = (state.satisfiedItems?.length ?? 0) + (state.missingItems?.length ?? 0) > 0;
    const hasApiChanges     = adjustedAnnotations.length > 0 || (state.parsedItems?.length ?? 0) > 0;
    const hasChanges        = userAnnotationsUnique.length > 0 || satisfiedCount > 0 || hasRequirements || hasApiChanges;

    navigate('/report', {
      state: {
        ...state,
        annotations: adjustedAnnotations,
        requirementBoxes: adjustedRequirementBoxes,
        baseFile:  baseFileArr[0]  ?? null,
        childFile: childFileArr[0] ?? null,
        // Forward the already-rendered preview URLs (data URLs for PDFs,
        // blob URLs for images). ReportPage uses these directly instead of
        // rebuilding from File objects, which may not survive the full
        // Index → Preview → Report navigation chain.
        basePreviewUrl:  activeBaseUrl || state.basePreviewUrl || '',
        childPreviewUrl: activeChildUrl || '',
        // Forward ALL child label URLs and names so the report can display every
        // new-version label when multiple were uploaded.
        childPreviewUrls: expandedChildPreviewUrls,
        childFileNames: (() => {
          const base = originalChildNames.length > 0 ? originalChildNames : childFilesAll.map(f => f.name);
          return base.map((n, i) => allLabelSkus[i] || n);
        })(),
        allLabelSkus,
        // Filter parsedItems for the main reportData fallback (used when isMultiPair is false)
        parsedItems: (() => {
          const idx = state.selectedResultIndex ?? 0;
          const pairDeletedIds = deletedDiscrepancyIdsByChildPreview[idx] ?? new Set<number | string>();
          const processedItems = state.allProcessedParsedItems?.[idx] ?? state.parsedItems ?? [];
          
          let validIds: Set<number | string>;
          if (state.allProcessedBboxIds?.[idx]) {
            validIds = new Set(state.allProcessedBboxIds[idx]);
          } else {
            validIds = new Set(state.bboxDiscrepancyIds ?? []);
          }

          return processedItems.filter((item: any) =>
            item.discrepancy_id == null || !pairDeletedIds.has(item.discrepancy_id)
          ).filter((item: any) => validIds.has(item.discrepancy_id));
        })(),
        // Build per-pair data for multi-label reports. Each entry carries its own
        // base/child URLs, file names, and raw AI results so the report page can
        // render independent label comparisons + change tables for every pair.
        allPairs: (() => {
          const allApiResults: any[] = state.apiResults ?? [];
          if (allApiResults.length === 0) return [];
          // Per-child filtered annotation arrays from Index.tsx (bbox deletions already applied)
          const adjustedMap = state.allAdjustedAnnotations as Record<string, any[]> | undefined;
          return allApiResults.map((result: any, i: number) => {
            // Use this pair's own deletion set — avoids cross-pair contamination
            const pairDeletedIds: Set<number | string> = deletedDiscrepancyIdsByChildPreview[i] ?? new Set<number | string>();
            const processedItems = state.allProcessedParsedItems?.[i] ?? result.parsedItems ?? [];
            
            let pairValidIds: Set<number | string>;
            if (state.allProcessedBboxIds?.[i]) {
              pairValidIds = new Set(state.allProcessedBboxIds[i]);
            } else {
              pairValidIds = new Set(state.bboxDiscrepancyIds ?? []);
            }

            const filteredParsedItems = processedItems.filter((item: any) =>
              item.discrepancy_id == null || !pairDeletedIds.has(item.discrepancy_id)
            ).filter((item: any) => pairValidIds.has(item.discrepancy_id));
            // Build the filtered annotation list for this pair:
            // 1. Start from the Index.tsx-adjusted array (bbox deletions from the analysis page),
            //    or fall back to raw API data filtered by discrepancy_id.
            // 2. Remove any boxes the user additionally hid inside PreviewPage.
            const baseAnns: any[] = adjustedMap?.[i] != null
              ? adjustedMap[i]
              : (() => {
                  // Use the same annotation source that hiddenAiBoxIdsByChild was derived from
                  // so that annotation-N index IDs stay aligned with baseAnns[N].
                  // For the original child, that source is state.annotations (processed by Index.tsx).
                  // For all other children it is the pre-processed annotations from Index.tsx (if available) or raw.
                  const rawAnns = state.allProcessedAnnotations?.[i] ?? 
                    (i === (state.selectedResultIndex ?? 0) ? (state.annotations ?? []) : (result.annotations ?? []));
                  return rawAnns.filter((ann: any) =>
                    ann.discrepancy_id == null || !pairDeletedIds.has(ann.discrepancy_id)
                  );
                })();
            const hiddenInPreview = hiddenAiBoxIdsByChild[i] ?? [];
            const filteredAnnotations = hiddenInPreview.length > 0
              ? baseAnns.filter((_: any, idx: number) => !hiddenInPreview.includes(`annotation-${idx}`))
              : baseAnns;
            const pairAnnotations: UserAnnotation[] = userAnnotationsByChild[i] ?? [];
            // Deduplicate by groupId to produce one entry per annotation group
            const seenGroups = new Set<string>();
            const pairUniqueAnnotations = pairAnnotations.filter((a: UserAnnotation) => {
              if (seenGroups.has(a.groupId)) return false;
              seenGroups.add(a.groupId);
              return true;
            });
            return {
              pairIndex:    i,
              // Fall back to index 0 when fewer base labels were uploaded than child labels
              baseUrl:      expandedBasePreviewUrls[i]  ?? expandedBasePreviewUrls[0]  ?? '',
              childUrl:     expandedChildPreviewUrls[i] ?? '',
              baseFileName: pdfPageName(
                expandedBaseFileNames[i] ?? expandedBaseFileNames[0],
                originalBaseNames[i]     ?? originalBaseNames[0],
              ),
              childFileName:
                allLabelSkus[i] ||
                pdfPageName(
                  childFilesAll[i]?.name,
                  originalChildNames[i] ?? originalChildNames[0],
                ),
              sku: allLabelSkus[i] || undefined,
              annotations:     filteredAnnotations,
              parsedItems:     filteredParsedItems,
              barcode_summary: result.barcode_summary ?? null,
              // Full box lists (one entry per drawn box) — used for image overlays
              userAnnotationsBase: pairAnnotations.filter(a => a.target === 'base'),
              userAnnotationsNew:  pairAnnotations.filter(a => a.target === 'new'),
              // One entry per group — used for report tables
              userExpectedUnique:   pairUniqueAnnotations.filter(a => a.disposition === 'Expected'),
              userUnexpectedUnique: pairUniqueAnnotations.filter(a => a.disposition !== 'Expected'),
              hasChanges: (
                pairAnnotations.length > 0 ||
                filteredAnnotations.length > 0 ||
                filteredParsedItems.length > 0
              ),
            };
          });
        })(),
        userAnnotationsBase,
        userAnnotationsNew,
        userAnnotationsUnique,
        userExpectedUnique,
        userUnexpectedUnique,
        hasChanges,
        // Preserve the child the user was actively viewing — overrides the
        // stale state.selectedResultIndex that came in from the previous page.
        selectedResultIndex: selectedChildIndex,
        // Preserve the full flat annotation array so drawn boxes survive the
        // /preview → /report → /preview round trip.
        userAnnotations,
        // Carry discarded unexpected IDs so ReportPage initializes correctly.
        discardedUnexpectedIds: [...discardedUnexpectedIds],
      },
    });
  };

  const handleBack = () => {
    navigate('/compare', {
      state: {
        formData:     state.formData,
        submissionId: state.submissionId,
        baseFile:     state.expandedBaseFiles ?? state.originalBaseFiles ?? baseFileArr,
        childFile:    childFileArr,
        // Pass back the full expanded child array + preview URLs + UI state so
        // /compare can fully restore its sidebar, selected child, and analysed
        // badges on remount (File objects alone are not sufficient — preview
        // URLs carry the visual state through location.state as plain strings).
        originalBaseFiles:        state.originalBaseFiles ?? state.baseFile,
        originalChildFiles:       state.originalChildFiles ?? state.childFiles,
        childFiles:               state.expandedChildFiles ?? state.childFiles ?? [],
        basePreviewUrl:           state.basePreviewUrl           ?? '',
        expandedBasePreviewUrls:  state.expandedBasePreviewUrls  ?? [],
        expandedChildPreviewUrls: state.expandedChildPreviewUrls ?? [],
        expandedBaseFileNames:    state.expandedBaseFileNames    ?? [],
        originalBaseNames:        state.originalBaseNames        ?? [],
        originalChildNames:       state.originalChildNames       ?? [],
        analysisRun:              state.analysisRun              ?? true,
        selectedResultIndex:      selectedChildIndex,
        apiResults:   state.apiResults  ?? [],
        lrfAnalysis:  state.lrfAnalysis ?? null,
        discardedUnexpectedIds: [...discardedUnexpectedIds],
        deletedDiscrepancyIds: [...(deletedDiscrepancyIdsByChildPreview[selectedChildIndex] ?? [])],
        reportId: state.reportId ?? '',
        userAnnotations,
        requirementBoxes,
        annotations: state.annotations ?? [],
        // Merge per-child maps: start with what Index.tsx passed, then overlay every
        // child's accumulated deletion set from this PreviewPage session so back-nav
        // restores the correct deleted state for ALL labels, not just the active one.
        allAdjustedAnnotations: state.allAdjustedAnnotations ?? {},
        allAdjustedBoxes: state.allAdjustedBoxes ?? {},
        allDeletedDiscrepancyIdsByChild: (() => {
          const base: Record<string, (number | string)[]> = { ...(state.allDeletedDiscrepancyIdsByChild ?? {}) };
          Object.entries(deletedDiscrepancyIdsByChildPreview).forEach(([k, v]) => {
            base[k] = [...v];
          });
          return base;
        })(),
      },
    });
  };

  // Label for the active add-location group
  const activeGroupLabel = activeGroupId
    ? annotationGroups.find(g => g.groupId === activeGroupId)?.text ?? ''
    : '';

  return (
    <div className="h-screen bg-[#f8f9fa] flex flex-col overflow-hidden">

      {/* Navbar */}
      <nav
        className="bg-[#D71500] text-white px-6 py-0 flex items-center justify-between shadow-md sticky top-0 z-40"
        style={{ minHeight: 52 }}
      >
        <div className="flex items-center gap-4 h-[52px]">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 border-r border-white/20 pr-4 h-full text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelIX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">Preview &amp; Annotate</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {formData && (
            <div className="hidden md:block">
              <StepIndicator
                current={4}
                total={4}
                labels={['Request Form', 'Review & Upload', 'Analysis', 'Preview']}
              />
            </div>
          )}
          <ProfileDropdown />
        </div>
      </nav>

      {/* Instructions + controls bar (replaces metadata bar) */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-[52px] z-30">
        <div className="space-y-0.5 max-w-3xl">
          <h2 className="text-sm font-bold text-gray-800">Preview &amp; Annotate Labels</h2>
          <p className="text-xs text-gray-500">
            Toggle <strong>Edit Mode</strong> and click-drag to add annotations.
            Use <strong>Add Location</strong> on any annotation to mark the same change in multiple places — they share a single report entry.
            AI-detected boxes can be <strong>clicked to select</strong>, then <strong>dragged to reposition</strong> or resized via corner handles.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            {(['Modified', 'Added', 'Deleted'] as AnnotationType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2" style={{ borderColor: TYPE_COLORS[t], backgroundColor: `${TYPE_COLORS[t]}20` }} />
                <span className="text-gray-600 font-medium">{t}</span>
              </div>
            ))}
          </div>

          {/* Edit mode toggle — only shown when NOT in add-location mode */}
          {!activeGroupId && (
            <button
              onClick={() => setIsDrawingMode(m => !m)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide border-2 transition-all ${
                isDrawingMode
                  ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-300'
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
              }`}
              title={isDrawingMode ? 'Click to exit edit mode' : 'Click to enable edit mode — stays on until you turn it off'}
            >
              <Pencil className="w-3.5 h-3.5" />
              {isDrawingMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-row">

        <LabelSidebar
          baseFile={baseFileArr[0] ?? null}
          basePreviewUrl={activeBaseUrl || null}
          baseFileName={activeBaseFileName}
          childFiles={childFilesAll}
          childFileNames={
            childFilesAll.length > 0
              ? childFilesAll.map((f, i) =>
                  allLabelSkus[i] ||
                  pdfPageName(f.name, originalChildNames[i] ?? originalChildNames[0])
                )
              : originalChildNames.map((n, i) => allLabelSkus[i] || n)
          }
          childPreviewUrls={expandedChildPreviewUrls}
          apiResults={state.apiResults ?? []}
          selectedIndex={selectedChildIndex}
          onSelectChild={handleSelectChild}
          analysisRun={true}
          forceClosedOnMount={true}
        />

        <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-5 space-y-4">


          {/* ── Active state banners ─────────────────────────────────────── */}

          {/* "Add Location" mode banner */}
          {activeGroupId && (
            <div className="bg-amber-50 border border-amber-300 px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-amber-800 min-w-0">
                <MapPin className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <span className="text-sm font-bold">Adding Location</span>
                  <span className="text-xs text-amber-700 ml-2">
                    for: <span className="font-semibold italic truncate">"{activeGroupLabel}"</span>
                  </span>
                  <div className="text-[10px] text-amber-600 mt-0.5">
                    Click and drag on either label to place another box. All boxes for this annotation will share one row in the report.
                  </div>
                </div>
              </div>
              <button
                onClick={handleExitAddLocation}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-2 border-amber-500 text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Done
              </button>
            </div>
          )}

          {/* Regular edit mode banner */}
          {isDrawingMode && !activeGroupId && (
            <div className="bg-blue-50 border border-blue-300 px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Pencil className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-bold">Edit Mode is ON</span>
                <span className="text-xs font-normal text-blue-500">
                  — Click and drag on either label image to draw a bounding box. Edit mode stays active until you turn it off.
                </span>
              </div>
              <button
                onClick={() => setIsDrawingMode(false)}
                className="text-blue-500 hover:text-blue-800 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Exit
              </button>
            </div>
          )}

          {/* Image panels */}
          <div className={hasBase && hasNew ? 'grid grid-cols-2 gap-5' : 'grid grid-cols-1 max-w-3xl mx-auto'}>
            {hasBase && (
              <DrawableImagePanel
                src={activeBaseUrl}
                title="Current Version"
                subtitle={activeBaseFileName}
                target="base"
                aiBoxes={[]}
                userBoxes={userBaseBoxes}
                isDrawingMode={isDrawingMode || !!activeGroupId}
                activeGroupId={activeGroupId}
                onDrawComplete={handleDrawComplete}
                onDeleteBox={handleDeleteBox}
                onDeleteAiBox={handleDeleteAiBox}
                onDuplicateBox={handleDuplicateBox}
                onAdjustAiBox={handleAdjustAiBox}
                highlightedGroupId={hoveredAnnotationId ?? selectedAnnotationId}
                isReadOnly={true}
                transformRef={basePanRef}
                onTransformed={handleBaseTransformed}
              />
            )}
            {hasNew && (
              <DrawableImagePanel
                key={`new-${selectedChildIndex}`}
                src={activeChildUrl}
                title="New Version"
                subtitle={activeChildFileName}
                target="new"
                aiBoxes={existingNewBoxes}
                userBoxes={userNewBoxes}
                isDrawingMode={isDrawingMode || !!activeGroupId}
                activeGroupId={activeGroupId}
                onDrawComplete={handleDrawComplete}
                onDeleteBox={handleDeleteBox}
                onDeleteAiBox={handleDeleteAiBox}
                onDuplicateBox={handleDuplicateBox}
                onAdjustAiBox={handleAdjustAiBox}
                highlightedGroupId={hoveredAnnotationId ?? selectedAnnotationId}
                initialAiOverrides={aiBoxAdjustments[selectedChildIndex]}
                transformRef={newPanRef}
                onTransformed={handleNewTransformed}
                onExpand={() => setIsExpanded(true)}
              />
            )}
            {!hasBase && !hasNew && (
              <div className="col-span-2 bg-white border border-dashed border-gray-300 py-16 text-center">
                <p className="text-sm text-gray-400">No label images available for preview.</p>
              </div>
            )}
          </div>

        </div>
        </div>{/* end flex-1 overflow-y-auto */}
        <ThemeProvider>
          <ReportDetailsPanel
            satisfiedItems={state?.satisfiedItems ?? []}
            missingItems={state?.missingItems ?? []}
            parsedItems={activeParsedItems}
            aiAnnotations={activeAnnotations}
            hiddenAiBoxIds={hiddenAiBoxIds}
            discardedUnexpectedIds={discardedUnexpectedIds}
            onDiscard={handleDiscard}
            analysisRun={true}
            annotations={userAnnotations}
            hoveredId={hoveredAnnotationId}
            selectedId={selectedAnnotationId}
            isDrawMode={isDrawingMode}
            onHoverAnnotation={handleHoverAnnotation}
            onSelectAnnotation={handleSelectAnnotation}
            onDeleteAnnotation={handleDeleteGroup}
          />
        </ThemeProvider>
      </main>

      {/* Footer action bar */}
      <div className="sticky bottom-0 bg-white border-t border-[#e2e8f0] px-8 py-2.5 flex items-center justify-between z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="text-xs text-slate-400 font-mono">
          {annotationGroups.length > 0
            ? `${annotationGroups.length} annotation${annotationGroups.length > 1 ? 's' : ''} · ${userAnnotations.length} box${userAnnotations.length > 1 ? 'es' : ''} total`
            : 'No reviewer annotations added'}
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={handleBack}
            className="text-[13px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
          >
            BACK
          </button>
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 bg-[#D71500] text-white px-8 py-3 text-[13px] font-bold uppercase tracking-widest hover:bg-[#b01300] transition-colors rounded-lg shadow-md"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Annotation dialog — only for the first box of a new group */}
      {pendingBox && (
        <AnnotationDialog
          pending={pendingBox}
          onSave={handleSaveAnnotation}
          onCancel={() => setPendingBox(null)}
        />
      )}

      {/* Expanded fullscreen modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col"
          style={{ overflow: 'hidden' }}
        >
          {/* Header */}
          <div className="bg-[#1e293b] text-white px-4 py-2 flex items-center justify-between flex-shrink-0 gap-3">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 opacity-70" />
              <span className="text-xs font-bold uppercase tracking-wider">Labels — Full View</span>
              {isDrawingMode && !activeGroupId && (
                <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 flex items-center gap-1 ml-1">
                  <Pencil className="w-2.5 h-2.5" /> Drawing active
                </span>
              )}
              {activeGroupId && (
                <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 flex items-center gap-1 ml-1">
                  <MapPin className="w-2.5 h-2.5" /> Adding location
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 hidden lg:block">
                Click-drag to draw · Click box to select · Drag selected to move · Esc to close
              </span>
              {!activeGroupId && (
                <button
                  onClick={() => setIsDrawingMode(m => !m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-2 transition-all ${
                    isDrawingMode
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Pencil className="w-3 h-3" />
                  {isDrawingMode ? 'Exit Edit' : 'Edit Mode'}
                </button>
              )}
              {activeGroupId && (
                <button
                  onClick={handleExitAddLocation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-amber-400 text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                >
                  <Check className="w-3 h-3" /> Done
                </button>
              )}
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button onClick={() => { expandedBasePanRef.current?.zoomIn(0.3); expandedNewPanRef.current?.zoomIn(0.3); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors" title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
              <button onClick={() => { expandedBasePanRef.current?.zoomOut(0.3); expandedNewPanRef.current?.zoomOut(0.3); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors" title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
              <button onClick={() => { expandedBasePanRef.current?.resetTransform(); expandedNewPanRef.current?.resetTransform(); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors" title="Reset zoom"><RotateCcw className="h-3.5 w-3.5" /></button>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 bg-red-600/30 hover:bg-red-600/50 rounded border border-red-500/40 transition-colors"
                title="Close fullscreen (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Panel area */}
          <div className={`flex-1 overflow-hidden ${hasBase && hasNew ? 'grid grid-cols-2' : 'flex'} bg-[#f1f5f9]`} style={{ minHeight: 0 }}>
            {hasBase && (
              <div className="border-r-4 border-[#94a3b8] h-full overflow-hidden">
                <DrawableImagePanel
                  src={activeBaseUrl}
                  title="Current Version"
                  subtitle={activeBaseFileName}
                  target="base"
                  aiBoxes={[]}
                  userBoxes={userBaseBoxes}
                  isDrawingMode={isDrawingMode || !!activeGroupId}
                  activeGroupId={activeGroupId}
                  onDrawComplete={handleDrawComplete}
                  onDeleteBox={handleDeleteBox}
                  onDeleteAiBox={handleDeleteAiBox}
                  onDuplicateBox={handleDuplicateBox}
                  onAdjustAiBox={handleAdjustAiBox}
                  highlightedGroupId={hoveredAnnotationId ?? selectedAnnotationId}
                  isReadOnly={true}
                  transformRef={expandedBasePanRef}
                  onTransformed={handleExpandedBaseTransformed}
                />
              </div>
            )}
            {hasNew && (
              <DrawableImagePanel
                key={`expanded-new-${selectedChildIndex}`}
                src={activeChildUrl}
                title="New Version"
                subtitle={activeChildFileName}
                target="new"
                aiBoxes={existingNewBoxes}
                userBoxes={userNewBoxes}
                isDrawingMode={isDrawingMode || !!activeGroupId}
                activeGroupId={activeGroupId}
                onDrawComplete={handleDrawComplete}
                onDeleteBox={handleDeleteBox}
                onDeleteAiBox={handleDeleteAiBox}
                onDuplicateBox={handleDuplicateBox}
                onAdjustAiBox={handleAdjustAiBox}
                highlightedGroupId={hoveredAnnotationId ?? selectedAnnotationId}
                initialAiOverrides={aiBoxAdjustments[selectedChildIndex]}
                transformRef={expandedNewPanRef}
                onTransformed={handleExpandedNewTransformed}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPage;
