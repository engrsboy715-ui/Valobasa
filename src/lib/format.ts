export const bdt = (n: number): string => `৳ ${n.toFixed(2).replace(/\.00$/, '')}`;

export const bdtPlain = (n: number): string => n.toFixed(2).replace(/\.00$/, '') === '' ? '0' : n.toFixed(2).replace(/\.00$/, '');

// 100 Coins = 1 BDT (0.01 BDT per coin)
export const COINS_PER_BDT = 100;

export const coinsToBdt = (coins: number): number => coins / COINS_PER_BDT;

export const coinsToBdtDisplay = (coins: number): string => bdt(coinsToBdt(coins));

export function copy(text: string): void {
  try {
    navigator.clipboard?.writeText(text);
  } catch {
    /* ignore */
  }
}

export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function genWorkId(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `WID-${n}`;
}
