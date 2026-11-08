export function sourceInformation(
  extra: Record<string, string>
): [string, string][] {
  const column = (key: string) => {
    const match = key.match(/^(\d+):/);
    return match ? Number(match[1]) : Infinity;
  };
  const entries = Object.entries(extra).sort(([a], [b]) => {
    const first = column(a);
    const second = column(b);
    return first === second ? a.localeCompare(b) : first - second;
  });
  let lastPopulatedColumn = -1;
  for (const [key, value] of entries) {
    const index = column(key);
    if (Number.isFinite(index) && value.trim()) {
      lastPopulatedColumn = Math.max(lastPopulatedColumn, index);
    }
  }
  return entries.filter(([key]) => {
    const index = column(key);
    return !Number.isFinite(index) || index <= lastPopulatedColumn;
  });
}
