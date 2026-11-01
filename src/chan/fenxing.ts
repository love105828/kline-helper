/** 2. 分型识别：顶分型（中间K线高低点均最高）/ 底分型（均最低） */
import type { MergedBar, Fenxing } from './types';

export function findFractals(merged: MergedBar[]): Fenxing[] {
  const out: Fenxing[] = [];
  for (let i = 1; i < merged.length - 1; i++) {
    const pre = merged[i - 1], cur = merged[i], nxt = merged[i + 1];
    if (cur.high > pre.high && cur.high > nxt.high && cur.low > pre.low && cur.low > nxt.low) {
      out.push({ i, kind: 'top', day: cur.highDay, price: cur.high });
    } else if (cur.low < pre.low && cur.low < nxt.low && cur.high < pre.high && cur.high < nxt.high) {
      out.push({ i, kind: 'bottom', day: cur.lowDay, price: cur.low });
    }
  }
  return out;
}
