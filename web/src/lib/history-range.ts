export type HistoryPreset = '7' | '30' | '6months' | 'all';

export function historyRange(
  preset: HistoryPreset,
  today: string
): { from: string; to: string } {
  if (preset === 'all') return { from: '', to: '' };
  // Work in UTC with the installation's calendar date, avoiding DST shifts.
  const date = new Date(`${today}T00:00:00Z`);
  if (preset === '6months') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 6);
    const end = new Date(date);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, end.getUTCDate()));
  } else {
    date.setUTCDate(date.getUTCDate() - (Number(preset) - 1));
  }
  return { from: date.toISOString().slice(0, 10), to: today };
}
