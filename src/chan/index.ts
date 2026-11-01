/** 缠论分析入口：K线 → 包含合并 → 分型 → 笔 → 段 → 中枢 → 走势/买卖点 */
import type { ChanBox, ChanConfig, ChanDraw, ChanNode, Fenxing, KLine } from './types';
import { DEFAULT_CHAN_CONFIG } from './types';
import { mergeKlines } from './merge';
import { findFractals } from './fenxing';
import { buildStrokes } from './bi';
import { buildSegments, buildSegmentsFS } from './duan';
import { buildPivots } from './zhongshu';
import { calcMacd, detectMarkers, trendLabels, trendNodes } from './trend';

/** 端点表 → 原站格式的节点行 [day, price, 涨跌, 方向, (标签)] */
function toNodes(list: Fenxing[], tagExtra?: string): ChanNode[] {
  const out: ChanNode[] = [];
  let prev: number | null = null;
  for (const p of list) {
    const delta = prev === null ? '' : Math.round((p.price - prev) * 100) / 100;
    const direction = prev === null ? '' : p.price > prev ? 'up' : 'down';
    const row: ChanNode = [p.day, Math.round(p.price * 1000) / 1000, delta, direction];
    if (tagExtra) row.push(tagExtra);
    out.push(row);
    prev = p.price;
  }
  return out;
}

const boxToRaw = (b: ChanBox): [[[string, number], [string, number], [string, number], [string, number], [string, string]]] =>
  [[[b.d0, b.zg], [b.d1, b.zg], [b.d1, b.zd], [b.d0, b.zd], ['', b.label]]] as any;

export function computeChan(kline: KLine[], config: Partial<ChanConfig> = {}): ChanDraw {
  const cfg = { ...DEFAULT_CHAN_CONFIG, ...config };
  const macd = calcMacd(kline.map((k) => k.close));

  // 缺口处理：跳空相邻K线（价格无重叠）视为1根K线合并
  let src: KLine[] = kline;
  if (cfg.gapMerge) {
    src = [];
    for (const k of kline) {
      const last = src[src.length - 1];
      if (last && (k.high < last.low || k.low > last.high)) {
        last.high = Math.max(last.high, k.high);
        last.low = Math.min(last.low, k.low);
        last.close = k.close;
        last.volume += k.volume;
      } else {
        src.push({ ...k });
      }
    }
  }

  const merged = mergeKlines(src);
  const fxs = findFractals(merged);
  const { confirmed: strokes, virtual: vstrokePt } = buildStrokes(fxs, cfg.gap);

  // 参与段/中枢计算的完整端点表 = 已确认 + 虚笔端点
  const points: Fenxing[] = vstrokePt ? [...strokes, vstrokePt] : [...strokes];
  // 段划分：按算法开关路由（三种可切换）
  const segRes = cfg.segAlgo === 'simple'
    ? buildSegments(points, cfg.minStrokes)
    : buildSegmentsFS(points, cfg.segAlgo === 'fs_strict');
  const { segments, virtual: vsegPt } = segRes;

  // 笔中枢：以段边界分段构建（zsRange 控制是否延伸）
  const strokeboxes: ChanBox[] = [];
  const bounds = [...new Set(segments.map((p) => p._idx))].sort((a, b) => a - b);
  for (let x = 0; x + 1 < bounds.length; x++) {
    strokeboxes.push(...buildPivots(points, bounds[x], bounds[x + 1], '笔', cfg.zsRange === 'all'));
  }
  // 段中枢：段端点表全表构建
  const segmentboxes = buildPivots(segments, 0, segments.length - 1, '段', cfg.zsRange === 'all');

  // 中枢框绘制基准：endpoint=ZG/ZD actual=GG/DD 实际高低点
  if (cfg.zsStd === 'actual') {
    for (const box of [...strokeboxes, ...segmentboxes]) {
      const zg = box.zg, zd = box.zd;
      box.zg = box.gg; box.zd = box.dd;
      box.gg = zg; box.dd = zd; // 保留原区间于 gg/dd 供参考
    }
  }

  // 走势：基于笔中枢中点连线（笔中枢数量充足，走势线连续可读）+ 走势类型标注
  const segPtOnly = segments.map((p) => ({ i: p.i, kind: p.kind, day: p.day, price: p.price }));
  const { confirmed: trendConf, virtual: trendVir } = trendNodes(
    strokeboxes, vsegPt ?? null, kline.length ? kline[kline.length - 1].close : 0,
  );
  const trendNodeList: ChanNode[] = trendConf.map(([d, p], idx) => {
    const prev = idx > 0 ? trendConf[idx - 1][1] : null;
    return [d, p, prev === null ? '' : Math.round((p - prev) * 100) / 100, prev === null ? '' : p > prev ? 'up' : 'down'] as ChanNode;
  });
  const vTrendList: ChanNode[] = trendVir.length
    ? [trendConf[trendConf.length - 1] as any, [...trendVir[1], '', 'up', '虚'] as ChanNode].filter(Boolean)
    : [];

  const lastClose = kline.length ? kline[kline.length - 1].close : 0;
  const markers = cfg.showMarkers ? detectMarkers(strokes, kline, macd, strokeboxes) : [];

  // 走势类型标注：第 2 个笔中枢起，标注与前一中枢的位置关系（挂在中枢中点）
  const trendMarks = strokeboxes.map((b, i) => {
    if (i === 0) return null;
    const prev = strokeboxes[i - 1];
    const mid = Math.round((b.zg + b.zd) / 2 * 100) / 100;
    let text: string;
    if (b.zd > prev.zg) text = '上涨趋势';
    else if (b.zg < prev.zd) text = '下跌趋势';
    else text = '中枢扩展';
    return { day: b.d0, price: mid, text };
  }).filter(Boolean) as { day: string; price: number; text: string }[];

  return {
    typing: fxs.map((f) => [f.day, Math.round(f.price * 100) / 100, ''] as [string, number, string]),
    stroke: toNodes(strokes),
    vstroke: vstrokePt && strokes.length ? toNodes([strokes[strokes.length - 1], vstrokePt], '虚笔') : [],
    segment: toNodes(segPtOnly),
    vsegment: vsegPt && segments.length ? toNodes([segPtOnly[segPtOnly.length - 1], vsegPt], '虚段') : [],
    trend: trendNodeList,
    vtrend: vTrendList,
    strokebox: strokeboxes,
    segmentbox: segmentboxes,
    trendbox: [],
    markers,
    macd,
    trendMarks,
    trendLabels: trendLabels(segmentboxes),
    line: lastClose ? [{ type: 'price', point: Math.round(lastClose * 1000) / 1000 }] : [],
  };
}

export { boxToRaw };
