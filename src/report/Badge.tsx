import { useTheme } from './ThemeContext';

interface BadgeProps {
  type: 'Added' | 'Deleted' | 'Modified' | 'Repositioned' | 'Misplaced';
}

export function Badge({ type }: BadgeProps) {
  const { theme } = useTheme();
  const colorMap = {
    Added: theme.statusColors.added,
    Deleted: theme.statusColors.deleted,
    Modified: theme.statusColors.modified,
    Repositioned: theme.statusColors.repositioned,
    Misplaced: theme.statusColors.repositioned,
  };
  const color = colorMap[type];
  return (
    <span
      className="inline-block w-20 py-1 text-xs border text-center"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}60` }}
    >
      {type}
    </span>
  );
}
