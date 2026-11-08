export function sourceInformation(
  extra: Record<string, string>
): [string, string][] {
  const column = (key: string) => {
    const match = key.match(/^(\d+):/);
    return match ? Number(match[1]) : Infinity;
  };
  return Object.entries(extra).sort(([a], [b]) => {
    const first = column(a);
    const second = column(b);
    return first === second ? a.localeCompare(b) : first - second;
  });
}
