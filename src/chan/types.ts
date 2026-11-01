/** 缠论算法类型定义（输出结构与原站 API 契约同构） */
import type { KLine } from '../api/cnfin';

/** 合并后的K线：处理包含关系，记录极值发生的原始交易日 */
export interface MergedBar {
  day: string;       // 该合并K线首个交易日
  highDay: string;   // 最高价发生的原始日
  lowDay: string;    // 最低价发生的原始日
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** 合并前的原始K线根数 */
  rawCount: number;
}

export type FxKind = 'top' | 'bottom';

export interface Fenxing {
  i: number;         // 合并K线索引
  kind: FxKind;
  day: string;       // 极值日（顶=highDay 底=lowDay）
  price: number;
}

/** 笔/段/走势端点：[day, price, 涨跌值, 方向, (标签)] */
export type ChanNode = [string, number, number | string, string] | [string, number, number | string, string, string];

/** 中枢矩形 */
export interface ChanBox {
  d0: string;
  d1: string;
  zg: number;
  zd: number;
  gg: number;
  dd: number;
  n: number;
  label: string;     // "9 笔" / "5 段"
}

/** 买卖点标记（reason 为成因数据，供点击详情展示） */
export interface ChanMarker {
  day: string;
  price: number;
  type: 'B1' | 'S1' | 'B2' | 'S2' | 'B3' | 'S3';
  label: string;     // 一买 / 一卖 / 二买 / ...
  reason?: Record<string, any>;
}

export interface MacdSeries {
  dif: number[];
  dea: number[];
  hist: number[];
}

export interface ChanDraw {
  typing: [string, number, string][];
  stroke: ChanNode[];
  vstroke: ChanNode[];
  segment: ChanNode[];
  vsegment: ChanNode[];
  trend: ChanNode[];
  vtrend: ChanNode[];
  strokebox: ChanBox[];
  segmentbox: ChanBox[];
  trendbox: ChanBox[];
  markers: ChanMarker[];
  macd: MacdSeries;
  /** 走势类型标注（挂在段中枢起始处）：上涨趋势/下跌趋势/中枢扩展 */
  trendMarks: { day: string; price: number; text: string }[];
  trendLabels: { day: string; text: string }[];
  line: { type: 'price'; point: number }[];
}

export interface ChanConfig {
  /** 笔的最小分型间隔（合并K线数）：4=严格(严笔) 3=宽松(宽笔) */
  gap: number;
  /** 构成段的最少笔数 */
  minStrokes: number;
  /** 是否标注买卖点 */
  showMarkers: boolean;
  /** 缺口处理：false=不处理 true=跳空缺口视为1根K线（合并） */
  gapMerge: boolean;
  /** 中枢区间重合：'all'=所有元素延伸 'first3'=仅前三元素 */
  zsRange: 'all' | 'first3';
  /** 中枢框绘制：'endpoint'=起终点(ZG/ZD) 'actual'=实际高低点(GG/DD) */
  zsStd: 'endpoint' | 'actual';
  /** 最小组件：'duan'=段(特征序列) 'bi'=笔(走势递归) */
  minComponent: 'duan' | 'bi';
  /** 段算法：'simple'=简化特征序列 'fs_strict'=标准特征序列·严格包含 'fs_optimize'=标准特征序列·优化包含 */
  segAlgo: 'simple' | 'fs_strict' | 'fs_optimize';
}

export const DEFAULT_CHAN_CONFIG: ChanConfig = {
  gap: 4,
  minStrokes: 3,
  showMarkers: true,
  gapMerge: false,
  zsRange: 'all',
  zsStd: 'endpoint',
  minComponent: 'duan',
  segAlgo: 'fs_strict',
};

export type { KLine };
