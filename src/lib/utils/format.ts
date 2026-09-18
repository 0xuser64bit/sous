export function shortAddr(addr: string, n = 4): string {
  if (!addr || addr.length < n * 2 + 3) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export function fmtCook(lamportsLike: number | string, decimals = 9): string {
  const n = Number(lamportsLike) / 10 ** decimals;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
