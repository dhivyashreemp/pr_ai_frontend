import { useTheme } from './ThemeContext';

interface BadgeProps {
  type: 'Added' | 'Deleted' | 'Modified' | 'Repositioned' | 'Misplaced' | 'Add' | 'Remove' | 'Modify';
}

const LABEL_MAP: Record<string, string> = {
  Added: 'Add', Add: 'Add',
  Deleted: 'Remove', Remove: 'Remove',
  Modified: 'Modify', Modify: 'Modify',
  Repositioned: 'Repositioned',
  Misplaced: 'Misplaced',
};

export function Badge({ type }: BadgeProps) {
  const { theme } = useTheme();
  const colorMap: Record<string, string> = {
    Added: theme.statusColors.added,    Add: theme.statusColors.added,
    Deleted: theme.statusColors.deleted, Remove: theme.statusColors.deleted,
    Modified: theme.statusColors.modified, Modify: theme.statusColors.modified,
    Repositioned: theme.statusColors.repositioned,
    Misplaced: theme.statusColors.repositioned,
  };
  const color = colorMap[type];
  return (
    <span
      className="inline-block w-20 py-1 text-xs border text-center"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}60` }}
    >
      {LABEL_MAP[type] ?? type}
    </span>
  );
}
