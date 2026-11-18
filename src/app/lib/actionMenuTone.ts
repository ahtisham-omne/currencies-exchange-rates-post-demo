// Shared tone → colour mapping for the segregated action menus (invoice +
// payment, listing + detail). Returns BOTH the menu-item text classes and an
// explicit icon colour class, because DropdownMenuItem forces any icon without
// a `text-*` class to muted grey — so the icon must carry its own colour to
// match the label (green Approve, amber warnings, red destructive actions).
export type ActionTone = 'positive' | 'warning' | 'destructive' | 'neutral';

export function actionToneClass(tone: ActionTone): { item: string; icon: string } {
  switch (tone) {
    case 'positive':
      return {
        item: 'text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50',
        icon: 'text-emerald-600',
      };
    case 'warning':
      return {
        item: 'text-amber-600 focus:text-amber-700 focus:bg-amber-50',
        icon: 'text-amber-600',
      };
    case 'destructive':
      return {
        item: 'text-rose-600 focus:text-rose-600 focus:bg-rose-50',
        icon: 'text-rose-600',
      };
    default:
      return { item: '', icon: 'text-muted-foreground' };
  }
}
