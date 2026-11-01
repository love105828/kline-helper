/** 1. K线包含关系合并 */
import type { KLine, MergedBar } from './types';

/**
 * 缠论K线预处理：相邻K线存在包含关系（高低点全包）时按趋势方向合并。
 * 上升趋势：取高高/高低合并（max high, max low）；下降趋势：取低低（min high, min low）。
 * 合并后记录极值出现的原始交易日，供分型定位用。
 */
export function mergeKlines(bars: KLine[]): MergedBar[] {
  const m: MergedBar[] = [];
  for (const raw of bars) {
    const b: MergedBar = {
      day: raw.day, highDay: raw.day, lowDay: raw.day,
      open: raw.open, high: raw.high, low: raw.low, close: raw.close,
      volume: raw.volume, rawCount: 1,
    };
    if (m.length === 0) {
      m.push(b);
      continue;
    }
    const last = m[m.length - 1];
    const incl =
      (b.high >= last.high && b.low <= last.low) ||
      (b.high <= last.high && b.low >= last.low);
    if (!incl) {
      m.push(b);
      continue;
    }
    // 与前一合并K线比较确定方向
    let dirUp: boolean | null = null;
    if (m.length >= 2) {
      const prev = m[m.length - 2];
      if (last.high > prev.high && last.low > prev.low) dirUp = true;
      else if (last.high < prev.high && last.low < prev.low) dirUp = false;
    }
    if (dirUp === null) dirUp = b.high >= last.high; // 无方向信息时按新高判断
    const newHigh = dirUp ? Math.max(last.high, b.high) : Math.min(last.high, b.high);
    const newLow = dirUp ? Math.max(last.low, b.low) : Math.min(last.low, b.low);
    if (newHigh !== last.high) last.highDay = b.high > last.high ? b.day : last.highDay;
    if (newLow !== last.low) last.lowDay = b.low < last.low ? b.day : last.lowDay;
    last.high = newHigh;
    last.low = newLow;
    last.close = b.close;
    last.volume += b.volume;
    last.rawCount += 1;
  }
  return m;
}
