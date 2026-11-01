/** 缠论分析结果缓存（跨页面共享，避免 AI 页重复拉取K线计算） */
import type { KLine } from '../api/cnfin';
import type { ChanDraw } from '../chan/types';

interface ChanCache {
  symbol: string;
  period: string;
  fq: number;
  klines: KLine[];
  draw: ChanDraw;
  time: number;
}

let cache: ChanCache | null = null;

export function setChanCache(symbol: string, period: string, fq: number, klines: KLine[], draw: ChanDraw) {
  cache = { symbol, period, fq, klines, draw, time: Date.now() };
}

/** 获取缓存的缠论结果（5 分钟内有效且标的/周期/复权匹配） */
export function getChanCache(symbol: string, period: string, fq: number): ChanCache | null {
  if (!cache) return null;
  if (cache.symbol !== symbol || cache.period !== period || cache.fq !== fq) return null;
  if (Date.now() - cache.time > 5 * 60 * 1000) return null;
  return cache;
}
