import { useRef, useCallback, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export const PLACEHOLDER_LABEL_CHILD = "/LCN-187301111_1_Rev-E.png";

export interface Annotation {
  label: string;
  change_type: "Added" | "Deleted" | "Modified" | "Repositioned";
  category: string;
  x: number;      // normalized 0–1
  y: number;
  width: number;
  height: number;
  confidence: "high" | "medium" | "low";
}

const ANNOTATION_COLORS: Record<string, string> = {
  Added:       "#1a7a4a",
  Deleted:     "#D51900",
  Modified:    "#2050c0",
  Repositioned:"#b07d00",
};

const AnnotationOverlay = ({
  annotations,
  naturalW,
  naturalH,
}: {
  annotations: Annotation[];
  naturalW: number;
  naturalH: number;
}) => {
  if (!annotations.length || !naturalW || !naturalH) return null;
  // stroke width scales with image size so it's always visible regardless of zoom
  const strokeW = Math.max(naturalW, naturalH) * 0.004;
  const fontSize = Math.max(naturalW, naturalH) * 0.022;

  return (
    <svg
      viewBox={`0 0 ${naturalW} ${naturalH}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {annotations.map((ann, i) => {
        const color = ANNOTATION_COLORS[ann.change_type] ?? "#555";
        const x = ann.x * naturalW;
        const y = ann.y * naturalH;
        const w = ann.width * naturalW;
        const h = ann.height * naturalH;
        const opacity = ann.confidence === "high" ? 1 : ann.confidence === "medium" ? 0.75 : 0.5;
        const dash = ann.change_type === "Deleted" ? `${strokeW * 3} ${strokeW * 2}` : undefined;

        const badgeY = y + strokeW;               // inside rect, just below the top border
        const badgeH = fontSize * 1.4;
        const badgeTextY = badgeY + badgeH * 0.78; // vertical centre of badge

        return (
          <g key={i} opacity={opacity}>
            {/* fill */}
            <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.12} />
            {/* border */}
            <rect
              x={x} y={y} width={w} height={h}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeDasharray={dash}
            />
            {/* label badge — sits inside the rect so the dashed border never overlaps text */}
            <rect
              x={x + strokeW}
              y={badgeY}
              width={Math.min(w - strokeW * 2, ann.label.length * fontSize * 0.62 + fontSize * 0.6)}
              height={badgeH}
              fill={color}
              rx={strokeW}
            />
            <text
              x={x + strokeW + fontSize * 0.3}
              y={badgeTextY}
              fill="white"
              fontSize={fontSize}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {ann.change_type.toUpperCase()}: {ann.label.length > 22 ? ann.label.slice(0, 22) + "…" : ann.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const VisualDiffViewer = ({
  baseImage,
  childImage,
  annotations = [],
}: {
  baseImage?: string;
  childImage?: string;
  annotations?: Annotation[];
}) => {
  const baseRef = useRef<any>(null);
  const childRef = useRef<any>(null);
  const [childNatural, setChildNatural] = useState({ w: 0, h: 0 });

  const singlePanel = !baseImage; // no base → single-column layout

  const handleZoomIn  = useCallback(() => { baseRef.current?.zoomIn();  childRef.current?.zoomIn();  }, []);
  const handleZoomOut = useCallback(() => { baseRef.current?.zoomOut(); childRef.current?.zoomOut(); }, []);
  const handleReset   = useCallback(() => { baseRef.current?.resetTransform(); childRef.current?.resetTransform(); }, []);

  return (
    <div className="border border-border bg-white">

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Visual Diff Viewer
        </span>
        <div className="flex items-center gap-1">
          <button onClick={handleZoomIn}  className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Zoom In">
            <ZoomIn  className="h-4 w-4" />
          </button>
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={handleReset}   className="p-1.5 hover:bg-secondary transition-colors border border-border" title="Reset">
            <RotateCcw className="h-4 w-4" />
          </button>
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
          {annotations.length > 0 && (
            <span className="absolute right-4 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5">
              {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Image panels */}
      <div className={`grid ${singlePanel ? "grid-cols-1" : "grid-cols-2"}`}>

        {/* Base (current version) — only rendered when provided */}
        {!singlePanel && (
          <div className="border-r border-border bg-[#f1f5f9] h-[480px] overflow-hidden p-4">
            <TransformWrapper ref={baseRef} minScale={0.5} maxScale={4} initialScale={1}>
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <img
                  src={baseImage}
                  alt="Current version label"
                  className="max-w-full max-h-full object-contain"
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}

        {/* Child (new version) — with annotation SVG overlay */}
        <div className="bg-[#f1f5f9] h-[480px] overflow-hidden p-4">
          <TransformWrapper ref={childRef} minScale={0.5} maxScale={4} initialScale={1}>
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {childImage ? (
                /* Wrapper shrinks to the exact rendered image size so SVG aligns perfectly */
                <div style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
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
                  <AnnotationOverlay
                    annotations={annotations}
                    naturalW={childNatural.w}
                    naturalH={childNatural.h}
                  />
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
        <LegendItem color="bg-status-added"    label="Added"        />
        <LegendItem color="bg-status-deleted"  label="Deleted" />
        <LegendItem color="bg-status-modified" label="Modified"     />
        <LegendItem color="bg-status-misplaced" label="Repositioned" />
      </div>
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
