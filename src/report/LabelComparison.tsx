import { useTheme } from './ThemeContext';
import type { DrawnBox } from './types';

interface BoundingBox {
  label: string;
  type: 'Modified' | 'Added' | 'Deleted' | 'Misplaced';
  top: string;
  left: string;
  width: string;
  labelOffset?: string;
}

interface LabelComparisonProps {
  show?: 'both' | 'master';
  currentLabelUrl?: string;
  currentLabelName?: string;
  newLabelUrl?: string;
  newLabelName?: string;
  currentBoxes?: DrawnBox[];
  newBoxes?: DrawnBox[];
}

const revDBoxes: BoundingBox[] = [
  { label: 'Modified', type: 'Modified', top: '4.4%',  left: '14.3%', width: '3.6%' },
  { label: 'Modified', type: 'Modified', top: '4.4%',  left: '80.8%', width: '17.6%', labelOffset: '8px' },
  { label: 'Deleted',  type: 'Deleted',  top: '16.7%', left: '88.9%', width: '11.1%' },
  { label: 'Modified', type: 'Modified', top: '22.1%', left: '0.5%',  width: '19.6%' },
  { label: 'Deleted',  type: 'Deleted',  top: '66.4%', left: '47.5%', width: '11%' },
  { label: 'Deleted',  type: 'Deleted',  top: '66.4%', left: '67%',   width: '27.9%', labelOffset: '4px' },
  { label: 'Modified', type: 'Modified', top: '81.4%', left: '64.8%', width: '24.7%' },
  { label: 'Modified', type: 'Modified', top: '96.5%', left: '92.9%', width: '3%' },
];

const revEBoxes: BoundingBox[] = [
  { label: 'Modified', type: 'Modified', top: '4.3%',  left: '14.4%', width: '4.5%' },
  { label: 'Modified', type: 'Modified', top: '4.3%',  left: '79.9%', width: '17.5%', labelOffset: '8px' },
  { label: 'Modified', type: 'Modified', top: '21.8%', left: '0.7%',  width: '54.6%' },
  { label: 'Added',    type: 'Added',    top: '64.6%', left: '48.5%', width: '11%' },
  { label: 'Modified', type: 'Modified', top: '74.1%', left: '64.1%', width: '24.3%' },
  { label: 'Modified', type: 'Modified', top: '96.3%', left: '92%',   width: '3.5%' },
];

function LabelBox({ src, title, subtitle, boxes, drawnBoxes }: {
  src: string; title: string; subtitle?: string;
  boxes?: BoundingBox[]; drawnBoxes?: DrawnBox[];
}) {
  const { theme } = useTheme();
  const typeColorMap: Record<BoundingBox['type'], string> = {
    Modified:  theme.statusColors.modified,
    Added:     theme.statusColors.added,
    Deleted:   theme.statusColors.deleted,
    Misplaced: theme.statusColors.repositioned,
  };

  return (
    <div className="bg-white border border-gray-300" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <div className="bg-gray-100 border-b border-gray-300 px-4 py-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{title}</div>
        {subtitle && <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4">
        <div className="relative w-full">
          <img src={src} alt={title} className="report-label-img w-full h-auto block" />
          {boxes?.map((box, i) => {
            const color = typeColorMap[box.type];
            return (
              <div key={i} className="absolute pointer-events-none inline-block"
                style={{ top: box.top, left: box.left, transform: `translateY(calc(-100% - 2px + ${box.labelOffset ?? '0px'}))` }}>
                <span className="font-semibold whitespace-nowrap block" style={{ color, fontSize: '9px', lineHeight: 1 }}>
                  {box.label}
                </span>
              </div>
            );
          })}
          {drawnBoxes?.map(box => {
            const color = typeColorMap[box.type];
            return (
              <div key={box.id}>
                <div className="absolute pointer-events-none"
                  style={{ top: `${box.top}%`, left: `${box.left}%`, width: `${box.width}%`, height: `${box.height}%`,
                    border: `2px solid ${color}`, backgroundColor: 'transparent' }} />
                <div className="absolute pointer-events-none inline-block"
                  style={{ top: `${box.top}%`, left: `${box.left}%`, transform: 'translateY(calc(-100% - 2px))' }}>
                  <span className="font-semibold whitespace-nowrap block" style={{ color, fontSize: '9px', lineHeight: 1 }}>
                    {box.text || box.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LabelComparison({ show = 'both', currentLabelUrl, currentLabelName, newLabelUrl, newLabelName, currentBoxes: drawnCurrentBoxes, newBoxes: drawnNewBoxes }: LabelComparisonProps) {
  const hasCurrent = !!currentLabelUrl;
  const hasNew     = !!newLabelUrl;
  // Demo mode: neither real image provided — show static placeholder labels with hardcoded annotations
  const isDemoMode = !hasCurrent && !hasNew;

  const currentSrc      = currentLabelUrl ?? '/LCN-187301111_1_Rev-D.png';
  const currentSubtitle = currentLabelName ?? 'LCN-187301111_1_Rev-D';
  const newSrc          = newLabelUrl      ?? '/LCN-187301111_1_Rev-E.png';
  const newSubtitle     = newLabelName     ?? 'LCN-187301111_1_Rev-E';

  // When show='both' but no current label was uploaded, collapse to single column
  const effectiveShow = (show === 'both' && !hasCurrent) ? 'master' : show;

  return (
    <div className={effectiveShow === 'both' ? 'grid grid-cols-2 gap-6' : 'grid grid-cols-1'} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      {effectiveShow === 'both' && (
        <LabelBox src={currentSrc} title="Current Version Label" subtitle={currentSubtitle}
          boxes={isDemoMode ? revDBoxes : undefined} drawnBoxes={isDemoMode ? undefined : drawnCurrentBoxes} />
      )}
      <LabelBox src={newSrc} title="New Version Label" subtitle={newSubtitle}
        boxes={isDemoMode ? revEBoxes : undefined} drawnBoxes={isDemoMode ? undefined : drawnNewBoxes} />
    </div>
  );
}
