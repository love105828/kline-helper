/** 4. 线段：简化特征序列法 */
import type { Fenxing } from './types';

export interface SegmentsResult {
  /** 段端点序列（指向 points 的引用，带 _idx 指回笔端点索引） */
  segments: (Fenxing & { _idx: number })[];
  virtual: Fenxing | null;
}

/**
 * 特征序列线段算法（标准近似）：
 * - 对向上段，收集全部逆向笔（顶→底）作为特征序列元素 [low, high]
 * - 相邻元素存在包含关系时按段方向合并：
 *     严格包含（strictInclude=true）：前包含后（段终点非最高/最低点的情形）
 *     优化包含（false）：非笔破坏情况下第三元素不进行前包含后（段终点为最高/最低点）
 * - 合并后序列出现顶分型（向上段）→ 段终结于分型前的极值端点，方向翻转
 */
export function buildSegmentsFS(points: Fenxing[], strictInclude = true): SegmentsResult {
  const pts = points.map((p, idx) => ({ ...p, _idx: idx }));
  const n = pts.length;
  if (n < 3) {
    const segs = pts;
    const virtual = segs.length && segs[segs.length - 1]._idx < n - 1 ? pts[n - 1] : null;
    return { segments: segs, virtual };
  }

  interface El { high: number; low: number; endIdx: number }
  const segs: (Fenxing & { _idx: number })[] = [pts[0]];
  let start = 0;

  while (start < n - 1) {
    const dir = pts[start + 1].price > pts[start].price ? 1 : -1;
    // 收集本段（起点 start 到数据末尾）中与段方向相反的笔 → 特征序列元素
    const raw: El[] = [];
    for (let k = start + 1; k < n; k++) {
      const a = pts[k - 1], b = pts[k];
      if (dir === 1) {
        if (b.price < a.price) raw.push({ high: a.price, low: b.price, endIdx: k });
      } else {
        if (b.price > a.price) raw.push({ high: b.price, low: a.price, endIdx: k });
      }
    }
    // 包含合并
    const merged: El[] = [];
    for (const e of raw) {
      const last = merged[merged.length - 1];
      const contains = last
        ? (last.high >= e.high && last.low <= e.low) || (e.high >= last.high && e.low <= last.low)
        : false;
      if (last && contains) {
        if (strictInclude) {
          // 严格包含：按段方向合并（向上段取高高，向下段取低低）
          if (dir === 1) { last.high = Math.max(last.high, e.high); last.low = Math.max(last.low, e.low); }
          else { last.high = Math.min(last.high, e.high); last.low = Math.min(last.low, e.low); }
        } else {
          // 优化包含：仅"后元素被前元素包含"时合并（前包含后），保留更极值端点
          last.endIdx = last.high >= e.high ? last.endIdx : e.endIdx;
          last.high = dir === 1 ? Math.max(last.high, e.high) : Math.min(last.high, e.high);
          last.low = dir === 1 ? Math.max(last.low, e.low) : Math.min(last.low, e.low);
        }
        last.endIdx = Math.max(last.endIdx, e.endIdx);
      } else {
        merged.push({ ...e });
      }
    }
    // 特征序列分型 → 段终点
    let endPt: (Fenxing & { _idx: number }) | null = null;
    if (dir === 1) {
      for (let k = 1; k < merged.length - 1; k++) {
        if (merged[k].high > merged[k - 1].high && merged[k].high > merged[k + 1].high) {
          // 段终点扫描上界：
          //   优化包含（第三元素不前包含后）→ 段终点为最高/最低点（扫到分型中元素末笔）
          //   严格包含（第三元素前包含后）→ 段终点提前（扫到分型第一元素末笔，非最高点）
          const bound = strictInclude ? merged[k - 1].endIdx : merged[k].endIdx;
          let best = pts[start + 1];
          for (let q = start + 1; q <= bound; q++) if (pts[q].price > best.price) best = pts[q];
          if (best.kind === 'top' && best._idx > start) endPt = best;
          break;
        }
      }
    } else {
      for (let k = 1; k < merged.length - 1; k++) {
        if (merged[k].low < merged[k - 1].low && merged[k].low < merged[k + 1].low) {
          const bound = strictInclude ? merged[k - 1].endIdx : merged[k].endIdx;
          let best = pts[start + 1];
          for (let q = start + 1; q <= bound; q++) if (pts[q].price < best.price) best = pts[q];
          if (best.kind === 'bottom' && best._idx > start) endPt = best;
          break;
        }
      }
    }
    if (!endPt) {
      // 段未终结：剩余全部为虚段
      break;
    }
    segs.push(endPt);
    start = endPt._idx;
  }

  const lastSeg = segs[segs.length - 1];
  const virtual = lastSeg._idx < n - 1 ? pts[n - 1] : null;
  return { segments: segs, virtual };
}

/**
 * 简化特征序列线段（旧算法，"最小组件=笔"走势递归路径使用）：
 * - 段方向 = 首笔方向；同向笔延续段
 * - 反向笔（回调）不破前回调极值则段延续，破了且段内已有 >= minStrokes 笔则段在上一端点翻转
 */
export function buildSegments(points: Fenxing[], minStrokes = 3): SegmentsResult {
  const pts = points.map((p, idx) => ({ ...p, _idx: idx }));
  const n = pts.length;
  if (n < 2) return { segments: pts, virtual: null };

  const segs: (Fenxing & { _idx: number })[] = [pts[0], pts[1]];
  let segDir = pts[1].price > pts[0].price ? 1 : -1;
  let segStartK = 1;
  let prevCorr: (Fenxing & { _idx: number }) | null = null;

  for (let k = 2; k < n; k++) {
    const up = pts[k].price > pts[k - 1].price;
    if (up === (segDir === 1)) continue; // 同向，延续
    if (prevCorr === null) {
      prevCorr = pts[k];
      continue;
    }
    const broke = segDir === 1 ? pts[k].price < prevCorr.price : pts[k].price > prevCorr.price;
    if (broke && k - segStartK >= minStrokes) {
      segs.push(pts[k]);
      segDir = -segDir;
      segStartK = k;
      prevCorr = null;
    } else {
      prevCorr = pts[k];
    }
  }
  const virtual = segs[segs.length - 1] !== pts[n - 1] ? pts[n - 1] : null;
  return { segments: segs, virtual };
}
