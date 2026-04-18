import { useTheme } from './ThemeContext';
import type { DrawnBox } from './types';

interface LabelComparisonProps {
  show?: 'both' | 'master';
  currentLabelUrl?: string;
  currentLabelName?: string;
  newLabelUrl?: string;
  newLabelName?: string;
  currentBoxes?: DrawnBox[];
  newBoxes?: DrawnBox[];
}

// Demo-mode hardcoded boxes for placeholder images
const demoCurrentBoxes: DrawnBox[] = [
  { id: 'd1', type: 'Modified', top: 4.4,  left: 14.3, width: 3.6,  height: 3.5,  text: 'Modified' },
  { id: 'd2', type: 'Modified', top: 4.4,  left: 80.8, width: 17.6, height: 3.5,  text: 'Modified' },
  { id: 'd3', type: 'Deleted',  top: 16.7, left: 88.9, width: 11.1, height: 4.0,  text: 'Deleted' },
  { id: 'd4', type: 'Modified', top: 22.1, left: 0.5,  width: 19.6, height: 4.5,  text: 'Modified' },
  { id: 'd5', type: 'Deleted',  top: 66.4, left: 47.5, width: 11.0, height: 4.0,  text: 'Deleted' },
  { id: 'd6', type: 'Deleted',  top: 66.4, left: 67.0, width: 27.9, height: 4.0,  text: 'Deleted' },
  { id: 'd7', type: 'Modified', top: 81.4, left: 64.8, width: 24.7, height: 4.0,  text: 'Modified' },
  { id: 'd8', type: 'Modified', top: 96.5, left: 92.9, width: 3.0,  height: 3.0,  text: 'Modified' },
];

const demoNewBoxes: DrawnBox[] = [
  { id: 'e1', type: 'Modified', top: 4.3,  left: 14.4, width: 4.5,  height: 3.5,  text: 'Modified' },
  { id: 'e2', type: 'Modified', top: 4.3,  left: 79.9, width: 17.5, height: 3.5,  text: 'Modified' },
  { id: 'e3', type: 'Modified', top: 21.8, left: 0.7,  width: 54.6, height: 4.5,  text: 'Modified' },
  { id: 'e4', type: 'Added',    top: 64.6, left: 48.5, width: 11.0, height: 4.0,  text: 'Added' },
  { id: 'e5', type: 'Modified', top: 74.1, left: 64.1, width: 24.3, height: 4.0,  text: 'Modified' },
  { id: 'e6', type: 'Modified', top: 96.3, left: 92.0, width: 3.5,  height: 3.0,  text: 'Modified' },
];

function LegendBar() {
  const { theme } = useTheme();
  const items = [
    { label: 'Modified', color: theme.statusColors.modified },
    { label: 'Added',    color: theme.statusColors.added },
    { label: 'Deleted',  color: theme.statusColors.deleted },
  ];
  return (
    <div className="flex items-center gap-6 py-2 px-1 mb-2">
      {items.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 border-2 flex-shrink-0"
            style={{ borderColor: color, backgroundColor: `${color}22` }}
          />
          <span className="text-xs font-medium text-gray-700">{label}</span>
        </div>
      ))}
    </div>
  );
}

function LabelBox({
  src,
  title,
  subtitle,
  drawnBoxes,
  showNoChangesBadge,
}: {
  src: string;
  title: string;
  subtitle?: string;
  drawnBoxes?: DrawnBox[];
  showNoChangesBadge?: boolean;
}) {
  const { theme } = useTheme();
  const typeColorMap: Record<DrawnBox['type'], string> = {
    Modified:  theme.statusColors.modified,
    Added:     theme.statusColors.added,
    Deleted:   theme.statusColors.deleted,
    Misplaced: theme.statusColors.repositioned,
  };

  return (
    <div className="bg-white border border-gray-300" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      {/* Section header */}
      <div className="border-b border-gray-300 px-4 py-2.5 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-700">{title}</div>
          {subtitle && <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {showNoChangesBadge && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: theme.statusColors.added }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
            No Changes
          </div>
        )}
      </div>

      {/* Image with bounding boxes */}
      <div className="p-4">
        <div className="relative w-full select-none">
          <img
            src={src}
            alt={title}
            className="report-label-img w-full h-auto block"
            draggable={false}
          />
          {drawnBoxes?.map((box) => {
            const color = typeColorMap[box.type];
            return (
              <div
                key={box.id}
                className="absolute pointer-events-none"
                style={{
                  top:    `${box.top}%`,
                  left:   `${box.left}%`,
                  width:  `${box.width}%`,
                  height: `${box.height}%`,
                  border: `1px solid ${color}80`,
                  backgroundColor: `${color}12`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LabelComparison({
  show = 'both',
  currentLabelUrl,
  currentLabelName,
  newLabelUrl,
  newLabelName,
  currentBoxes,
  newBoxes,
}: LabelComparisonProps) {
  const hasCurrent = !!currentLabelUrl;
  const hasNew     = !!newLabelUrl;
  const isDemoMode = !hasCurrent && !hasNew;

  const currentSrc      = currentLabelUrl ?? '/LCN-187301111_1_Rev-D.png';
  const currentSubtitle = currentLabelName ?? 'LCN-187301111_1_Rev-D';
  const newSrc          = newLabelUrl      ?? '/LCN-187301111_1_Rev-E.png';
  const newSubtitle     = newLabelName     ?? 'LCN-187301111_1_Rev-E';

  const effectiveShow = (show === 'both' && !hasCurrent) ? 'master' : show;

  const resolvedCurrentBoxes = isDemoMode ? demoCurrentBoxes : (currentBoxes ?? []);
  const resolvedNewBoxes     = isDemoMode ? demoNewBoxes     : (newBoxes     ?? []);

  return (
    <div className="space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <LegendBar />

      {effectiveShow === 'both' ? (
        // Side-by-side layout: Current Version | New Version
        <div className="grid grid-cols-2 gap-4">
          <LabelBox
            src={currentSrc}
            title="Current Version"
            subtitle={currentSubtitle}
            drawnBoxes={resolvedCurrentBoxes}
          />
          <LabelBox
            src={newSrc}
            title="New Version"
            subtitle={newSubtitle}
            drawnBoxes={resolvedNewBoxes}
            showNoChangesBadge={!isDemoMode && resolvedNewBoxes.length === 0}
          />
        </div>
      ) : (
        <LabelBox
          src={newSrc}
          title="New Version"
          subtitle={newSubtitle}
          drawnBoxes={resolvedNewBoxes}
          showNoChangesBadge={!isDemoMode && resolvedNewBoxes.length === 0}
        />
      )}
    </div>
  );
}
