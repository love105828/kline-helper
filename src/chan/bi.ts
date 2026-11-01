/** 3. 笔：顶底分型交替连接，间隔 >= gap 根合并K线 */
import type { Fenxing } from './types';

export interface StrokesResult {
  /** 已确认笔的端点序列（相邻两端点构成一笔） */
  confirmed: Fenxing[];
  /** 最后一个未确认候选端点（虚笔终点） */
  virtual: Fenxing | null;
}

/**
 * 标准笔构建：
 * - 同性质分型连续出现时保留更极端者（顶取最高、底取最低）
 * - 相邻顶底分型合并K线索引差 >= gap（4=老笔严格 / 3=新笔宽松）
 * - 顶点价必须高于底点价（幅度校验）
 */
export function buildStrokes(fxs: Fenxing[], minGap = 4): StrokesResult {
  if (fxs.length === 0) return { confirmed: [], virtual: null };
  let anchor = fxs[0];
  const confirmed: Fenxing[] = [];
  for (const f of fxs.slice(1)) {
    if (f.kind === anchor.kind) {
      const moreExtreme = anchor.kind === 'top' ? f.price > anchor.price : f.price < anchor.price;
      if (moreExtreme) anchor = f;
      continue;
    }
    // 间隔不足或幅度不合法（顶低于底）时跳过该分型
    if (Math.abs(f.i - anchor.i) < minGap) continue;
    if (anchor.kind === 'top' && f.price >= anchor.price) continue;
    if (anchor.kind === 'bottom' && f.price <= anchor.price) continue;
    confirmed.push(anchor);
    anchor = f;
  }
  const virtual = confirmed.length > 0 && confirmed[confirmed.length - 1] !== anchor ? anchor : null;
  return { confirmed, virtual };
}
