import { useRef, useCallback, useState, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw, Move, Copy, X, Maximize2, Trash2 } from "lucide-react";

export const PLACEHOLDER_LABEL_CHILD = "/LCN-187301111_1_Rev-E.png";

export interface Annotation {
  label: string;
  change_type: "Added" | "Deleted" | "Modified" | "Repositioned";
  category: string;
  x: number;       // normalized 0–1
  y: number;
  width: number;
  height: number;
  confidence: "high" | "medium" | "low";
}

/** One draggable+resizable requirement box shown in proof-request mode. */
export interface RequirementBox {
  id: string;
  label: string;
  changeType: string;
  category: string;
  satisfied?: boolean;
  x: number;        // normalized 0–1 initial left
  y: number;        // normalized 0–1 initial top
  width: number;    // normalized 0–1
  height: number;   // normalized 0–1
}

const ANNOTATION_COLORS: Record<string, string> = {
  Added:        "#1a7a4a",
  Deleted:      "#D51900",
  Modified:     "#2050c0",
  Repositioned: "#b07d00",
};

// ── General AI annotation overlay ────────────────────────────────────────────

const AnnotationOverlay = ({
  annotations, naturalW, naturalH,
}: { annotations: Annotation[]; naturalW: number; naturalH: number }) => {
  if (!annotations.length || !naturalW || !naturalH) return null;
  const strokeW  = Math.max(naturalW, naturalH) * 0.004;
  const fontSize = Math.max(naturalW, naturalH) * 0.022;
  return (
    <svg
      viewBox={`0 0 ${naturalW} ${naturalH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }}
    >
      {annotations.map((ann, i) => {
        const color  = ANNOTATION_COLORS[ann.change_type] ?? "#555";
        const x = ann.x * naturalW, y = ann.y * naturalH;
        const w = ann.width * naturalW, h = ann.height * naturalH;
        const opacity  = ann.confidence === "high" ? 1 : ann.confidence === "medium" ? 0.75 : 0.5;
        const dash     = ann.change_type === "Deleted" ? `${strokeW * 3} ${strokeW * 2}` : undefined;
        const badgeY   = y + strokeW;
        const badgeH   = fontSize * 1.4;
        return (
          <g key={i} opacity={opacity}>
            <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.12} />
            <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
            <rect x={x + strokeW} y={badgeY} width={Math.min(w - strokeW * 2, ann.label.length * fontSize * 0.62 + fontSize * 0.6)} height={badgeH} fill={color} rx={strokeW} />
            <text x={x + strokeW + fontSize * 0.3} y={badgeY + badgeH * 0.78} fill="white" fontSize={fontSize} fontFamily="monospace" fontWeight="bold">
              {ann.change_type.toUpperCase()}: {ann.label.length > 22 ? ann.label.slice(0, 22) + "…" : ann.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Draggable + resizable requirement boxes ───────────────────────────────────

type ResizeDir = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

interface BoxState { x: number; y: number; w: number; h: number; }

const MIN_BOX = 0.02;   // minimum 2% of image dimension

/** Ghost preview data passed from parent during placement mode */
interface PlacingGhost {
  template: RequirementBox;
  color: string;
  x: number;
  y: number;
}

/** Placement state owned by the parent (VisualDiffViewer / ExpandedLabelModal) */
interface PlacingState {
  template: RequirementBox;
  color: string;
}

const getBoxVisuals = (box: RequirementBox) => {
  if (typeof box.satisfied === "boolean") {
    return box.satisfied
      ? { color: "#16a34a", bg: "rgba(22,163,74,0.10)" }
      : { color: "#D51900", bg: "rgba(213,25,0,0.10)" };
  }
  const color = ANNOTATION_COLORS[box.changeType] ?? "#555";
  return { color, bg: `${color}20` };
};

interface PlacementDraft {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const DraggableBoxOverlay = ({
  initialBoxes,
  containerRef,
  onBoxesChange,
  onAddBox,
  onDeleteBox,
  onRequestPlacement,
  placingGhost,
}: {
  initialBoxes: RequirementBox[];
  containerRef: React.RefObject<HTMLDivElement>;
  onBoxesChange?: (boxes: RequirementBox[]) => void;
  onAddBox?: (box: RequirementBox) => void;
  onDeleteBox?: (boxId: string) => void;
  /** Called when user clicks Duplicate — parent activates placement mode */
  onRequestPlacement?: (template: RequirementBox, color: string) => void;
  /** Ghost preview rendered while parent is in placement mode */
  placingGhost?: PlacingGhost | null;
}) => {
  const [states, setStates] = useState<BoxState[]>(
    initialBoxes.map(b => ({ x: b.x, y: b.y, w: b.width, h: b.height }))
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const statesRef = useRef(states);
  useEffect(() => { statesRef.current = states; }, [states]);

  const onBoxesChangeRef = useRef(onBoxesChange);
  onBoxesChangeRef.current = onBoxesChange;

  const commitBoxes = useCallback((nextStates: BoxState[]) => {
    onBoxesChangeRef.current?.(
      initialBoxes.map((box, i) => ({
        ...box,
        x: nextStates[i]?.x ?? box.x,
        y: nextStates[i]?.y ?? box.y,
        width: nextStates[i]?.w ?? box.width,
        height: nextStates[i]?.h ?? box.height,
      }))
    );
  }, [initialBoxes]);

  const drag = useRef<{
    type: "move" | ResizeDir;
    idx: number;
    startX: number; startY: number;
    orig: BoxState;
    moved: boolean;
  } | null>(null);

  const boxKey = initialBoxes.map(b => b.id).join(",");
  useEffect(() => {
    setStates(initialBoxes.map(b => ({ x: b.x, y: b.y, w: b.width, h: b.height })));
    setSelectedIdx(null);
    onBoxesChangeRef.current?.(initialBoxes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxKey]);

  const getNormDelta = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { dx: 0, dy: 0 };
    return {
      dx: (clientX - drag.current!.startX) / rect.width,
      dy: (clientY - drag.current!.startY) / rect.height,
    };
  };

  const applyDelta = (orig: BoxState, dx: number, dy: number, type: "move" | ResizeDir): BoxState => {
    let { x, y, w, h } = orig;
    switch (type) {
      case "move": x += dx; y += dy; break;
      case "se":   w += dx; h += dy; break;
      case "sw":   x += dx; w -= dx; h += dy; break;
      case "ne":   y += dy; w += dx; h -= dy; break;
      case "nw":   x += dx; y += dy; w -= dx; h -= dy; break;
      case "e":    w += dx; break;
      case "w":    x += dx; w -= dx; break;
      case "s":    h += dy; break;
      case "n":    y += dy; h -= dy; break;
    }
    w = Math.max(MIN_BOX, w);
    h = Math.max(MIN_BOX, h);
    x = Math.max(0, Math.min(1 - w, x));
    y = Math.max(0, Math.min(1 - h, y));
    return { x, y, w, h };
  };

  const onBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { type: "move", idx, startX: e.clientX, startY: e.clientY, orig: states[idx], moved: false };
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number, dir: ResizeDir) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { type: dir, idx, startX: e.clientX, startY: e.clientY, orig: states[idx], moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { dx, dy } = getNormDelta(e.clientX, e.clientY);
    if (!drag.current.moved) {
      const dxPx = e.clientX - drag.current.startX;
      const dyPx = e.clientY - drag.current.startY;
      if (Math.sqrt(dxPx * dxPx + dyPx * dyPx) > 5) drag.current.moved = true;
    }
    if (!drag.current.moved) return;
    const next = applyDelta(drag.current.orig, dx, dy, drag.current.type);
    const idx = drag.current.idx;
    setStates(prev => prev.map((s, i) => i === idx ? next : s));
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    const wasDrag = drag.current.moved;
    const idx     = drag.current.idx;
    drag.current = null;

    if (!wasDrag) {
      setSelectedIdx(prev => prev === idx ? null : idx);
      return;
    }

    setSelectedIdx(idx);
    commitBoxes(statesRef.current);
  };

  // Notify parent to enter placement mode — parent renders the capture overlay
  const handleDuplicate = (idx: number) => {
    const box   = initialBoxes[idx];
    const s     = statesRef.current[idx];
    const { color } = getBoxVisuals(box);
    onRequestPlacement?.({
      ...box,
      id:     `${box.id}-dup-${Date.now()}`,
      width:  s.w,
      height: s.h,
    }, color);
    setSelectedIdx(null);
  };

  const handleDelete = (idx: number) => {
    const boxId = initialBoxes[idx]?.id;
    if (!boxId) return;
    onDeleteBox?.(boxId);
    setSelectedIdx(null);
  };

  const handles: { dir: ResizeDir; style: React.CSSProperties; cursor: string }[] = [
    { dir: "nw", cursor: "nw-resize", style: { top: -4,    left: -4   } },
    { dir: "ne", cursor: "ne-resize", style: { top: -4,    right: -4  } },
    { dir: "sw", cursor: "sw-resize", style: { bottom: -4, left: -4   } },
    { dir: "se", cursor: "se-resize", style: { bottom: -4, right: -4  } },
    { dir: "n",  cursor: "n-resize",  style: { top: -4,    left: "calc(50% - 4px)" } },
    { dir: "s",  cursor: "s-resize",  style: { bottom: -4, left: "calc(50% - 4px)" } },
    { dir: "e",  cursor: "e-resize",  style: { right: -4,  top: "calc(50% - 4px)"  } },
    { dir: "w",  cursor: "w-resize",  style: { left: -4,   top: "calc(50% - 4px)"  } },
  ];

  return (
    <>
      {/* ── Normal drag/resize/select overlay ──────────────────────────────── */}
      <div
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={() => setSelectedIdx(null)}
      >
        {initialBoxes.map((box, idx) => {
          // states syncs via boxKey effect — guard against the one render before it fires
          const s          = states[idx] ?? { x: box.x, y: box.y, w: box.width, h: box.height };
          const isSelected = selectedIdx === idx;
          const { color, bg } = getBoxVisuals(box);
          return (
            <div
              key={box.id}
              className="no-pan"
              title={isSelected ? "Click again to deselect" : "Click to select • Drag to move • Handles to resize"}
              style={{
                position: "absolute",
                left:   `${s.x * 100}%`,
                top:    `${s.y * 100}%`,
                width:  `${s.w * 100}%`,
                height: `${s.h * 100}%`,
                border: `2px solid ${color}`,
                backgroundColor: bg,
                boxSizing: "border-box",
                cursor: "move",
                userSelect: "none",
                touchAction: "none",
                pointerEvents: "all",
                zIndex: 20,
                boxShadow: isSelected ? `0 0 0 3px ${color}, 0 0 0 5px white` : undefined,
                transition: "box-shadow 0.1s",
              }}
              onPointerDown={e => onBoxPointerDown(e, idx)}
            >
              {/* Label badge */}
              <div
                className="no-pan"
                style={{
                  position: "absolute",
                  top: -16, left: -1,
                  background: color,
                  color: "white",
                  fontSize: "8px",
                  lineHeight: "12px",
                  padding: "1px 5px 1px 3px",
                  borderRadius: "2px 2px 0 0",
                  fontFamily: "sans-serif",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  pointerEvents: "none",
                  boxShadow: "0 -1px 3px rgba(0,0,0,0.15)",
                }}
              >
                <Move style={{ width: 7, height: 7, flexShrink: 0 }} />
                {box.label.length > 24 ? box.label.slice(0, 24) + "…" : box.label}
              </div>

              {/* Action toolbar (when selected) */}
              {isSelected && (
                <div
                  className="no-pan"
                  style={{
                    position: "absolute",
                    bottom: -30,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    background: "white",
                    border: `1.5px solid ${color}`,
                    borderRadius: 4,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    padding: "2px 4px",
                    zIndex: 30,
                    whiteSpace: "nowrap",
                    pointerEvents: "all",
                  }}
                  onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                >
                  <button
                    className="no-pan"
                    title="Duplicate — then click or drag on the label to place a copy there"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(idx); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      fontSize: 9, fontWeight: 700, fontFamily: "sans-serif",
                      color: color, background: "none", border: "none",
                      cursor: "pointer", padding: "2px 4px", borderRadius: 3,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${color}15`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <Copy style={{ width: 9, height: 9 }} />
                    Duplicate
                  </button>
                  <div style={{ width: 1, height: 12, background: "#e2e8f0" }} />
                  <button
                    className="no-pan"
                    title="Delete this bounding box"
                    onClick={(e) => { e.stopPropagation(); handleDelete(idx); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      fontSize: 9, fontWeight: 700, fontFamily: "sans-serif",
                      color: "#dc2626", background: "none", border: "none",
                      cursor: "pointer", padding: "2px 4px", borderRadius: 3,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <Trash2 style={{ width: 9, height: 9 }} />
                    Delete
                  </button>
                  <div style={{ width: 1, height: 12, background: "#e2e8f0" }} />
                  <button
                    className="no-pan"
                    title="Deselect"
                    onClick={(e) => { e.stopPropagation(); setSelectedIdx(null); }}
                    style={{
                      display: "flex", alignItems: "center",
                      color: "#94a3b8", background: "none", border: "none",
                      cursor: "pointer", padding: "2px 3px", borderRadius: 3,
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              )}

              {/* Resize handles */}
              {handles.map(({ dir, style, cursor }) => (
                <div
                  key={dir}
                  className="no-pan"
                  style={{
                    position: "absolute",
                    width: 8, height: 8,
                    background: color,
                    border: "1px solid white",
                    borderRadius: 1,
                    cursor,
                    zIndex: 21,
                    ...style,
                  }}
                  onPointerDown={e => onHandlePointerDown(e, idx, dir)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Ghost box — pure visual preview from parent placement state */}
      {placingGhost && (
        <div
          style={{
            position: "absolute",
            left:   `${placingGhost.x * 100}%`,
            top:    `${placingGhost.y * 100}%`,
            width:  `${placingGhost.template.width  * 100}%`,
            height: `${placingGhost.template.height * 100}%`,
            border: `2px dashed ${placingGhost.color}`,
            backgroundColor: `${placingGhost.color}25`,
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 40,
          }}
        >
          <span style={{
            position: "absolute", top: -16, left: -1,
            background: placingGhost.color, color: "white",
            fontSize: "8px", lineHeight: "12px",
            padding: "1px 5px 1px 3px", borderRadius: "2px 2px 0 0",
            fontFamily: "sans-serif", fontWeight: 600,
            whiteSpace: "nowrap", opacity: 0.85,
          }}>
            {placingGhost.template.label.length > 24
              ? placingGhost.template.label.slice(0, 24) + "…"
              : placingGhost.template.label}
          </span>
        </div>
      )}
    </>
  );
};

// ── Placement capture overlay ─────────────────────────────────────────────────
// Rendered as a SIBLING of TransformWrapper (not inside it).
// This means react-zoom-pan-pinch never sees these pointer events and cannot
// intercept them or cause navigation redirects.

function PlacementOverlay({
  placing,
  wrapperRef,
  onPlace,
  onCancel,
  onGhostMove,
}: {
  placing: PlacingState;
  wrapperRef: React.RefObject<HTMLDivElement>;
  onPlace: (box: RequirementBox) => void;
  onCancel: () => void;
  onGhostMove: (pos: { x: number; y: number } | null) => void;
}) {
  const [draft, setDraft] = useState<PlacementDraft | null>(null);

  const getNormalizedPoint = useCallback((clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) {
      return null;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, [wrapperRef]);

  const clampGhost = useCallback((x: number, y: number, width: number, height: number) => ({
    x: Math.max(0, Math.min(1 - width, x)),
    y: Math.max(0, Math.min(1 - height, y)),
  }), []);

  const previewPlacement = useCallback((nextDraft: PlacementDraft | null) => {
    if (!nextDraft) {
      onGhostMove(null);
      return;
    }
    const dx = nextDraft.currentX - nextDraft.startX;
    const dy = nextDraft.currentY - nextDraft.startY;
    const moved = Math.abs(dx) > 0.008 || Math.abs(dy) > 0.008;

    if (!moved) {
      const pos = clampGhost(
        nextDraft.currentX - placing.template.width / 2,
        nextDraft.currentY - placing.template.height / 2,
        placing.template.width,
        placing.template.height
      );
      onGhostMove(pos);
      return;
    }

    const width = Math.max(MIN_BOX, Math.abs(dx));
    const height = Math.max(MIN_BOX, Math.abs(dy));
    const pos = clampGhost(
      Math.min(nextDraft.startX, nextDraft.currentX),
      Math.min(nextDraft.startY, nextDraft.currentY),
      width,
      height
    );
    onGhostMove(pos);
  }, [clampGhost, onGhostMove, placing.template.height, placing.template.width]);

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 50, cursor: "crosshair" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const point = getNormalizedPoint(e.clientX, e.clientY);
        if (!point) {
          onCancel();
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        const nextDraft = { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
        setDraft(nextDraft);
        previewPlacement(nextDraft);
      }}
      onPointerUp={(e)   => {
        e.stopPropagation();
        e.preventDefault();
        if (!draft) return;
        const point = getNormalizedPoint(e.clientX, e.clientY);
        const finalDraft = point ? { ...draft, currentX: point.x, currentY: point.y } : draft;
        const dx = finalDraft.currentX - finalDraft.startX;
        const dy = finalDraft.currentY - finalDraft.startY;
        const moved = Math.abs(dx) > 0.008 || Math.abs(dy) > 0.008;

        if (!moved) {
          const pos = clampGhost(
            finalDraft.currentX - placing.template.width / 2,
            finalDraft.currentY - placing.template.height / 2,
            placing.template.width,
            placing.template.height
          );
          onPlace({ ...placing.template, x: pos.x, y: pos.y });
        } else {
          const width = Math.max(MIN_BOX, Math.abs(dx));
          const height = Math.max(MIN_BOX, Math.abs(dy));
          const pos = clampGhost(
            Math.min(finalDraft.startX, finalDraft.currentX),
            Math.min(finalDraft.startY, finalDraft.currentY),
            width,
            height
          );
          onPlace({
            ...placing.template,
            x: pos.x,
            y: pos.y,
            width,
            height,
          });
        }

        setDraft(null);
      }}
      onPointerMove={(e) => {
        const point = getNormalizedPoint(e.clientX, e.clientY);
        if (!point) return;
        const nextDraft = draft
          ? { ...draft, currentX: point.x, currentY: point.y }
          : { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
        if (draft) setDraft(nextDraft);
        previewPlacement(nextDraft);
      }}
    >
      {/* Instruction banner */}
      <div style={{
        position: "absolute", top: 8, left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.82)", color: "white",
        fontSize: 11, fontWeight: 700, fontFamily: "sans-serif",
        padding: "6px 14px", borderRadius: 6,
        display: "flex", alignItems: "center", gap: 6,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        pointerEvents: "none",
      }}>
        <Copy style={{ width: 11, height: 11 }} />
        Click to place, or drag for an exact fit: "{placing.template.label.length > 22
          ? placing.template.label.slice(0, 22) + "…"
          : placing.template.label}"
        <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>· Esc to cancel</span>
      </div>
    </div>
  );
}

// ── Expanded fullscreen modal ─────────────────────────────────────────────────

const ExpandedLabelModal = ({
  childImage,
  isChildPdf = false,
  requirementBoxes,
  onBoxesChange,
  onAddBox,
  onDeleteBox,
  onClose,
}: {
  childImage: string;
  isChildPdf?: boolean;
  requirementBoxes: RequirementBox[];
  onBoxesChange?: (boxes: RequirementBox[]) => void;
  onAddBox?: (box: RequirementBox) => void;
  onDeleteBox?: (boxId: string) => void;
  onClose: () => void;
}) => {
  const transformRef = useRef<any>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);

  // Placement state lives here so the overlay can be a sibling of TransformWrapper
  const [placing,  setPlacing]  = useState<PlacingState | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Escape: cancel placement first, then close modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (placing) { setPlacing(null); setGhostPos(null); }
      else         { onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, placing]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleRequestPlacement = useCallback((template: RequirementBox, color: string) => {
    setPlacing({ template, color });
    setGhostPos(null);
  }, []);

  const handlePlace = useCallback((box: RequirementBox) => {
    onAddBox?.(box);
    setPlacing(null);
    setGhostPos(null);
  }, [onAddBox]);

  const handleCancelPlacement = useCallback(() => {
    setPlacing(null);
    setGhostPos(null);
  }, []);

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 4,
    color: "white",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "96vw", height: "94vh",
          background: "white",
          display: "flex", flexDirection: "column",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            background: "#1e293b", color: "white",
            padding: "8px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Maximize2 style={{ width: 13, height: 13, opacity: 0.7 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              New Version Label — Full View
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 600,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 3, padding: "1px 6px",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {requirementBoxes.length} bounding box{requirementBoxes.length !== 1 ? "es" : ""}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginRight: 4 }}>
              Click box → select &amp; duplicate • Drag to move • Handles to resize • Delete from toolbar • Esc to close
            </span>
            <button style={btnStyle} title="Zoom In"    onClick={() => transformRef.current?.zoomIn()}>
              <ZoomIn  style={{ width: 13, height: 13 }} />
            </button>
            <button style={btnStyle} title="Zoom Out"   onClick={() => transformRef.current?.zoomOut()}>
              <ZoomOut style={{ width: 13, height: 13 }} />
            </button>
            <button style={btnStyle} title="Reset zoom" onClick={() => transformRef.current?.resetTransform()}>
              <RotateCcw style={{ width: 13, height: 13 }} />
            </button>
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
            <button
              style={{ ...btnStyle, background: "rgba(220,38,38,0.25)", borderColor: "rgba(220,38,38,0.4)" }}
              title="Close expanded view (Esc)"
              onClick={onClose}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Image area — PlacementOverlay is a SIBLING of TransformWrapper here */}
        <div style={{ flex: 1, overflow: "hidden", background: "#f1f5f9", position: "relative" }}>
          {placing && (
            <PlacementOverlay
              placing={placing}
              wrapperRef={wrapperRef}
              onPlace={handlePlace}
              onCancel={handleCancelPlacement}
              onGhostMove={setGhostPos}
            />
          )}
          <TransformWrapper
            ref={transformRef}
            minScale={0.2} maxScale={10} initialScale={1}
            panning={{ excluded: ["no-pan"] }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <div
                ref={wrapperRef}
                style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
              >
                  {isChildPdf ? (
                    <embed
                      src={childImage}
                      type="application/pdf"
                      style={{ display: "block", width: "90vw", height: "calc(94vh - 100px)" }}
                    />
                  ) : (
                    <img
                      src={childImage}
                      alt="New version label — expanded"
                      style={{ display: "block", maxWidth: "90vw", maxHeight: "calc(94vh - 100px)" }}
                      draggable={false}
                    />
                  )}
                <DraggableBoxOverlay
                  initialBoxes={requirementBoxes}
                  containerRef={wrapperRef}
                  onBoxesChange={onBoxesChange}
                  onAddBox={onAddBox}
                  onDeleteBox={onDeleteBox}
                  onRequestPlacement={handleRequestPlacement}
                  placingGhost={placing && ghostPos ? { ...placing, ...ghostPos } : null}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* Legend footer */}
        <div
          style={{
            background: "white",
            borderTop: "1px solid #e2e8f0",
            padding: "6px 16px",
            display: "flex", alignItems: "center", gap: 16,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            Legend:
          </span>
          {[
            { color: "#16a34a", label: "Requirement Satisfied" },
            { color: "#D51900", label: "Requirement Missing"   },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: "#374151" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const VisualDiffViewer = ({
  baseImage,
  childImage,
  isBasePdf = false,
  isChildPdf = false,
  annotations      = [],
  requirementBoxes = [],
  onBoxesChange,
  onAddBox,
  onDeleteBox,
  onAnnotationsChange,
}: {
  baseImage?:         string;
  childImage?:        string;
  isBasePdf?:         boolean;
  isChildPdf?:        boolean;
  annotations?:       Annotation[];
  requirementBoxes?:  RequirementBox[];
  onBoxesChange?:     (boxes: RequirementBox[]) => void;
  onAddBox?:          (box: RequirementBox) => void;
  onDeleteBox?:       (boxId: string) => void;
  onAnnotationsChange?: (annotations: Annotation[]) => void;
}) => {
  const baseRef    = useRef<any>(null);
  const childRef   = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [childNatural, setChildNatural] = useState({ w: 0, h: 0 });
  const [isExpanded,   setIsExpanded]   = useState(false);

  // Placement state lives here so the overlay can be a SIBLING of TransformWrapper
  const [placing,  setPlacing]  = useState<PlacingState | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Cancel placement on Escape
  useEffect(() => {
    if (!placing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPlacing(null); setGhostPos(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [placing]);

  const singlePanel = !baseImage;
  const useReqBoxes = requirementBoxes.length > 0;
  const editableAnnotationBoxes: RequirementBox[] = annotations.map((ann, idx) => ({
    id: `annotation-${idx}`,
    label: ann.label,
    changeType: ann.change_type,
    category: ann.category,
    x: ann.x,
    y: ann.y,
    width: ann.width,
    height: ann.height,
  }));

  const handleAnnotationBoxesChange = useCallback((boxes: RequirementBox[]) => {
    const next = boxes.map((box, idx) => {
      const original = annotations[idx];
      return {
        ...(original ?? annotations[0]),
        label: box.label,
        change_type: box.changeType as Annotation["change_type"],
        category: box.category,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }).filter(Boolean) as Annotation[];
    onAnnotationsChange?.(next);
  }, [annotations, onAnnotationsChange]);

  const handleDeleteAnnotation = useCallback((boxId: string) => {
    const index = Number(boxId.replace("annotation-", ""));
    if (Number.isNaN(index)) return;
    onAnnotationsChange?.(annotations.filter((_, idx) => idx !== index));
  }, [annotations, onAnnotationsChange]);

  const handleAddAnnotation = useCallback((box: RequirementBox) => {
    onAnnotationsChange?.([
      ...annotations,
      {
        label: box.label,
        change_type: box.changeType as Annotation["change_type"],
        category: box.category,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        confidence: "high",
      },
    ]);
  }, [annotations, onAnnotationsChange]);

  const handleZoomIn  = useCallback(() => { baseRef.current?.zoomIn();         childRef.current?.zoomIn();         }, []);
  const handleZoomOut = useCallback(() => { baseRef.current?.zoomOut();        childRef.current?.zoomOut();        }, []);
  const handleReset   = useCallback(() => { baseRef.current?.resetTransform(); childRef.current?.resetTransform(); }, []);

  const handleRequestPlacement = useCallback((template: RequirementBox, color: string) => {
    setPlacing({ template, color });
    setGhostPos(null);
  }, []);

  const handlePlace = useCallback((box: RequirementBox) => {
    onAddBox?.(box);
    setPlacing(null);
    setGhostPos(null);
  }, [onAddBox]);

  const handleCancelPlacement = useCallback(() => {
    setPlacing(null);
    setGhostPos(null);
  }, []);

  return (
    <div className="border border-border bg-white">

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Visual Diff Viewer
        </span>
        <div className="flex items-center gap-2">
          {(useReqBoxes || annotations.length > 0) && (
            <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
              useReqBoxes
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-slate-700 bg-slate-50 border-slate-200"
            }`}>
              Click box → select &amp; duplicate • Drag to move • Handles to resize • Delete from toolbar
            </span>
          )}
          <div className="flex items-center gap-1">
            <button onClick={handleZoomIn}  className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Zoom In"><ZoomIn  className="h-4 w-4" /></button>
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Zoom Out"><ZoomOut className="h-4 w-4" /></button>
            <button onClick={handleReset}   className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Reset"><RotateCcw className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className={`grid ${singlePanel ? "grid-cols-1" : "grid-cols-2"} border-b border-border bg-white`}>
        {!singlePanel && (
          <div className="px-4 py-1.5 border-r border-border flex items-center justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current Version Label</span>
          </div>
        )}
        <div className="px-4 py-1.5 flex items-center justify-center relative">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">New Version Label</span>
          <div className="absolute right-3 flex items-center gap-2">
            {!useReqBoxes && annotations.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5">
                {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
              </span>
            )}
            {useReqBoxes && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5">
                {requirementBoxes.length} requirement{requirementBoxes.length !== 1 ? "s" : ""}
              </span>
            )}
            {(useReqBoxes || !!childImage) && (
              <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-colors"
                title="Open full-screen view for easier bounding box editing"
              >
                <Maximize2 className="w-3 h-3" />
                Expand
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image panels */}
      <div className={`grid ${singlePanel ? "grid-cols-1" : "grid-cols-2"}`}>

        {/* Base panel */}
        {!singlePanel && (
          <div className="border-r border-border bg-[#f1f5f9] h-[480px] overflow-hidden p-4">
            <TransformWrapper ref={baseRef} minScale={0.5} maxScale={4} initialScale={1}>
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {isBasePdf ? (
                  <embed src={baseImage} type="application/pdf" className="w-full h-full" style={{ minHeight: "448px" }} />
                ) : (
                  <img src={baseImage} alt="Current version label" className="max-w-full max-h-full object-contain" />
                )}
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}

        {/* Child panel — PlacementOverlay is a SIBLING of TransformWrapper (not inside it).
            This is the architectural fix: react-zoom-pan-pinch never intercepts these
            pointer events and clicking the overlay cannot trigger navigation. */}
        <div className="bg-[#f1f5f9] h-[480px] overflow-hidden p-4" style={{ position: "relative" }}>
          {placing && (
            <PlacementOverlay
              placing={placing}
              wrapperRef={wrapperRef}
              onPlace={handlePlace}
              onCancel={handleCancelPlacement}
              onGhostMove={setGhostPos}
            />
          )}
          <TransformWrapper
            ref={childRef}
            minScale={0.5} maxScale={4} initialScale={1}
            panning={{ excluded: ["no-pan"] }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {childImage ? (
                <div
                  ref={wrapperRef}
                  style={{ position: "relative", display: "inline-block", lineHeight: 0, overflow: "hidden" }}
                >
                  {isChildPdf ? (
                    <embed
                      src={childImage}
                      type="application/pdf"
                      className="w-full"
                      style={{ height: "448px" }}
                    />
                  ) : (
                    <img
                      src={childImage}
                      alt="New version label"
                      className="max-w-full max-h-full object-contain"
                      style={{ maxHeight: "448px" }}
                      onLoad={e => {
                        const img = e.currentTarget;
                        setChildNatural({ w: img.naturalWidth, h: img.naturalHeight });
                      }}
                    />
                  )}

                  {(useReqBoxes || annotations.length > 0) && (
                    <DraggableBoxOverlay
                      initialBoxes={useReqBoxes ? requirementBoxes : editableAnnotationBoxes}
                      containerRef={wrapperRef}
                      onBoxesChange={useReqBoxes ? onBoxesChange : handleAnnotationBoxesChange}
                      onAddBox={useReqBoxes ? onAddBox : handleAddAnnotation}
                      onDeleteBox={useReqBoxes ? onDeleteBox : handleDeleteAnnotation}
                      onRequestPlacement={handleRequestPlacement}
                      placingGhost={placing && ghostPos ? { ...placing, ...ghostPos } : null}
                    />
                  )}
                  {annotations.length > 0 && !useReqBoxes && false && (
                    <AnnotationOverlay annotations={annotations} naturalW={childNatural.w} naturalH={childNatural.h} />
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">No label uploaded</span>
              )}
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-t border-border bg-white px-4 py-2.5 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mr-1">Legend:</span>
        {useReqBoxes ? (
          <>
            <LegendItem color="bg-green-600"  label="Requirement Satisfied" />
            <LegendItem color="bg-[#D51900]"  label="Requirement Missing"   />
          </>
        ) : (
          <>
            <LegendItem color="bg-status-added"     label="Add"          />
            <LegendItem color="bg-status-deleted"   label="Remove"       />
            <LegendItem color="bg-status-modified"  label="Modify"       />
            <LegendItem color="bg-status-misplaced" label="Repositioned" />
          </>
        )}
      </div>

      {/* Fullscreen expanded modal */}
      {isExpanded && childImage && (
        <ExpandedLabelModal
          childImage={childImage}
          requirementBoxes={useReqBoxes ? requirementBoxes : editableAnnotationBoxes}
          onBoxesChange={useReqBoxes ? onBoxesChange : handleAnnotationBoxesChange}
          onAddBox={useReqBoxes ? onAddBox : handleAddAnnotation}
          onDeleteBox={useReqBoxes ? onDeleteBox : handleDeleteAnnotation}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-3 h-3 ${color}`} />
    <span className="text-xs font-medium text-foreground">{label}</span>
  </div>
);

export default VisualDiffViewer;
