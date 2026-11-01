/** 6. MACD、走势类型判定与买卖点 */
import type { ChanBox, ChanMarker, Fenxing, KLine, MacdSeries } from './types';

/** MACD(12,26,9)，国内口径 hist=(DIF-DEA)*2 */
export function calcMacd(closes: number[]): MacdSeries {
  const ema = (n: number): number[] => {
    const k = 2 / (n + 1);
    const out: number[] = [];
    let e = closes[0] ?? 0;
    for (let i = 0; i < closes.length; i++) {
      e = i === 0 ? closes[0] : closes[i] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  };
  const e12 = ema(12), e26 = ema(26);
  const dif = e12.map((v, i) => v - e26[i]);
  const dea: number[] = [];
  let acc = 0;
  for (let i = 0; i < dif.length; i++) {
    acc = i === 0 ? dif[0] : acc * 0.8 + dif[i] * 0.2;
    dea.push(acc);
  }
  const hist = dif.map((d, i) => (d - dea[i]) * 2);
  return { dif, dea, hist };
}

/** 走势类型：由相邻中枢的相对位置判定 */
export function trendLabels(boxes: ChanBox[]): { day: string; text: string }[] {
  const out: { day: string; text: string }[] = [];
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1], cur = boxes[i];
    let text: string;
    if (cur.zd > prev.zg) text = '上涨趋势';
    else if (cur.zg < prev.zd) text = '下跌趋势';
    else text = '中枢扩展';
    out.push({ day: cur.d0, text });
  }
  return out;
}

/** 走势线节点：段中枢中点连线（含到最新价/最新段端点的虚走势） */
export function trendNodes(boxes: ChanBox[], lastPoint: Fenxing | null, lastClose: number):
  { confirmed: [string, number][]; virtual: [string, number][] } {
  const confirmed: [string, number][] = boxes.map((b) => [b.d0, Math.round((b.zg + b.zd) / 2 * 100) / 100]);
  const virtual: [string, number][] = [];
  const last = confirmed[confirmed.length - 1];
  const tail = lastPoint ? [lastPoint.day, lastPoint.price] as [string, number] : null;
  if (last && tail) virtual.push(last, tail);
  else if (last && lastClose) virtual.push(last, ['', lastClose] as unknown as [string, number]);
  return { confirmed, virtual };
}

/**
 * 买卖点检测（简化实用版）：
 * - 一类：笔级别背驰（创新高/新低但 MACD 动能减弱）→ 顶/底背驰
 * - 三类：离开中枢后的回抽不再回到中枢区间
 */
export function detectMarkers(
  points: Fenxing[],          // 已确认笔端点
  klines: KLine[],
  macd: MacdSeries,
  boxes: ChanBox[],
): ChanMarker[] {
  const markers: ChanMarker[] = [];
  if (points.length < 4 || klines.length === 0) return markers;

  const dayIdx = new Map<string, number>();
  klines.forEach((k, i) => { if (!dayIdx.has(k.day)) dayIdx.set(k.day, i); });

  // 笔能量 = 区间内 |hist| 之和（附区间日期，供买卖点成因展示）
  const strength = (a: Fenxing, b: Fenxing): number => areaInfo(a, b).sum;
  const areaInfo = (a: Fenxing, b: Fenxing): { sum: number; from: string; to: string; difPeak: number; bars: number } => {
    const ia = dayIdx.get(a.day) ?? 0;
    const ib = dayIdx.get(b.day) ?? ia;
    let s = 0;
    let peak = macd.dif[ia] ?? 0;
    for (let i = ia; i <= Math.min(ib, macd.hist.length - 1); i++) {
      s += Math.abs(macd.hist[i]);
      peak = b.price > a.price ? Math.max(peak, macd.dif[i]) : Math.min(peak, macd.dif[i]);
    }
    return {
      sum: Math.round(s * 10) / 10, from: a.day, to: b.day,
      difPeak: Math.round(peak * 1000) / 1000,
      bars: Math.max(1, ib - ia + 1),
    };
  };

  // ---- 一类买卖点：隔笔同向比较 ----
  for (let j = 3; j < points.length; j++) {
    const p0 = points[j - 1], p1 = points[j];      // 当前笔 j-1 → j
    const q0 = points[j - 3], q1 = points[j - 2];  // 前一同向笔
    const up = p1.price > p0.price;
    if (up !== (q1.price > q0.price)) continue;
    const aCur = areaInfo(p0, p1);
    const aPrev = areaInfo(q0, q1);
    const sCur = aCur.sum, sPrev = aPrev.sum;
    if (sPrev <= 0) continue;
    if (up && p1.price > q1.price && sCur < sPrev * 0.85) {
      markers.push({
        day: p1.day, price: p1.price, type: 'S1', label: '一卖',
        reason: {
          prevExtreme: Math.round(q1.price * 100) / 100, prevDay: q1.day,
          curExtreme: Math.round(p1.price * 100) / 100, curDay: p1.day,
          prevArea: aPrev.sum, prevRange: [aPrev.from, aPrev.to], prevDif: aPrev.difPeak,
          curArea: aCur.sum, curRange: [aCur.from, aCur.to], curDif: aCur.difPeak,
          bars: aCur.bars,
          pivots: boxes
            .filter((b) => (dayIdx.get(b.d1) ?? 0) < (dayIdx.get(p1.day) ?? 0))
            .slice(-2)
            .map((b) => `${b.d0.slice(5)}~${b.d1.slice(5)}（${Math.round(b.zd * 100) / 100}~${Math.round(b.zg * 100) / 100}）`),
        },
      });
    } else if (!up && p1.price < q1.price && sCur < sPrev * 0.85) {
      markers.push({
        day: p1.day, price: p1.price, type: 'B1', label: '一买',
        reason: {
          prevExtreme: Math.round(q1.price * 100) / 100, prevDay: q1.day,
          curExtreme: Math.round(p1.price * 100) / 100, curDay: p1.day,
          prevArea: aPrev.sum, prevRange: [aPrev.from, aPrev.to], prevDif: aPrev.difPeak,
          curArea: aCur.sum, curRange: [aCur.from, aCur.to], curDif: aCur.difPeak,
          bars: aCur.bars,
          pivots: boxes
            .filter((b) => (dayIdx.get(b.d1) ?? 0) < (dayIdx.get(p1.day) ?? 0))
            .slice(-2)
            .map((b) => `${b.d0.slice(5)}~${b.d1.slice(5)}（${Math.round(b.zd * 100) / 100}~${Math.round(b.zg * 100) / 100}）`),
        },
      });
    }
  }

  // ---- 二类买卖点：一类点后隔一笔的同性质端点不创新极值 ----
  const ptIdxByDay = new Map(points.map((p, i) => [p.day, i]));
  for (const mk of [...markers]) {
    const j = ptIdxByDay.get(mk.day);
    if (j === undefined) continue;
    const next = points[j + 2]; // 隔一个反向笔
    if (!next) continue;
    if (mk.type === 'B1' && next.kind === 'bottom' && next.price > points[j].price) {
      markers.push({
        day: next.day, price: next.price, type: 'B2', label: '二买',
        reason: { b1Day: points[j].day, b1Price: Math.round(points[j].price * 100) / 100, curDay: next.day, curPrice: Math.round(next.price * 100) / 100 },
      });
    } else if (mk.type === 'S1' && next.kind === 'top' && next.price < points[j].price) {
      markers.push({
        day: next.day, price: next.price, type: 'S2', label: '二卖',
        reason: { b1Day: points[j].day, b1Price: Math.round(points[j].price * 100) / 100, curDay: next.day, curPrice: Math.round(next.price * 100) / 100 },
      });
    }
  }

  // ---- 三类买卖点：中枢离开后回抽不回中枢 ----
  for (const box of boxes) {
    const i0 = dayIdx.get(box.d0), i1 = dayIdx.get(box.d1);
    if (i0 === undefined || i1 === undefined) continue;
    const after = points.filter((p) => {
      const idx = dayIdx.get(p.day);
      return idx !== undefined && idx > i1;
    });
    for (let k = 0; k + 1 < after.length; k++) {
      const p = after[k];
      if (p.price > box.zg && p.kind === 'top') {
        // 向上离开后，下一个底分型回抽不进中枢 → 三买
        const nextBottom = after.slice(k + 1).find((q) => q.kind === 'bottom');
        if (nextBottom && nextBottom.price > box.zg) {
          markers.push({
            day: nextBottom.day, price: nextBottom.price, type: 'B3', label: '三买',
            reason: {
              pivot: `${box.d0.slice(5)}~${box.d1.slice(5)}`, zg: box.zg, zd: box.zd,
              gg: box.gg, dd: box.dd, n: box.n,
              leaveDay: p.day, leavePrice: Math.round(p.price * 100) / 100,
              pullbackDay: nextBottom.day, pullbackPrice: Math.round(nextBottom.price * 100) / 100,
            },
          });
        }
        break;
      }
      if (p.price < box.zd && p.kind === 'bottom') {
        const nextTop = after.slice(k + 1).find((q) => q.kind === 'top');
        if (nextTop && nextTop.price < box.zd) {
          markers.push({
            day: nextTop.day, price: nextTop.price, type: 'S3', label: '三卖',
            reason: {
              pivot: `${box.d0.slice(5)}~${box.d1.slice(5)}`, zg: box.zg, zd: box.zd,
              gg: box.gg, dd: box.dd, n: box.n,
              leaveDay: p.day, leavePrice: Math.round(p.price * 100) / 100,
              pullbackDay: nextTop.day, pullbackPrice: Math.round(nextTop.price * 100) / 100,
            },
          });
        }
        break;
      }
    }
  }

  // 去重（同日同类型）
  const seen = new Set<string>();
  return markers.filter((mk) => {
    const key = `${mk.day}|${mk.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
