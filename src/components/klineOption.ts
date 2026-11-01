/**
 * ECharts option 组装（纯函数，H5 与小程序双端共享）
 * 从 KLineChart.vue 的 render() 抽取，所有绘制决策集中在这里。
 */
import type { KLine } from '../api/cnfin';
import type { ChanBox, ChanDraw } from '../chan/types';

/* 配色（原站 option 实测值） */
export const C = {
  up: '#ec0000', down: '#00da60',
  stroke: '#f5a623',       // 笔 - 橙
  segment: '#9c27b0',      // 线段 - 紫
  trend: '#1e90ff',        // 走势 - 蓝
  strokeBoxFill: 'rgba(136,144,152,0.08)', strokeBoxLine: 'rgba(136,144,152,0.8)',
  segBoxFill: 'rgba(245,166,35,0.08)', segBoxLine: 'rgba(245,166,35,0.75)',
  dif: '#1e90ff', dea: '#ffd700',
  ma5: '#f5a623', ma10: '#1e90ff', ma20: '#9c27b0', ma60: '#889098',
};

export interface ChartToggles {
  showStroke: boolean;
  showSegment: boolean;
  showPivot: boolean;
  showTrend: boolean;
  showVol: boolean;
  showMacd: boolean;
  showMa: boolean;
  showMarkers: boolean;
  showCursor: boolean;
  /** 货币单位（Y轴顶部与信息栏）：元/港元/美元/点 */
  currencySuffix: string;
  /** Y轴短符号：¥/HK$/US$ */
  currencyAxis: string;
  /** 通达信公式输出线 */
  tdxLines?: { name: string; values: (number | null)[]; signal?: boolean }[];
  /** 量化策略演示信号（B=买 S=卖） */
  quantMarks?: { day: string; price: number; dir: 'B' | 'S' }[];
}

/** [day, price] 节点表 → [idx, price] 折线数据 */
function toLineData(rows: any[][], m: Map<string, number>): [number, number][] {
  const out: [number, number][] = [];
  for (const r of rows) {
    const idx = m.get(r[0]);
    if (idx !== undefined) out.push([idx, r[1]]);
  }
  return out;
}

function boxToRect(list: ChanBox[], m: Map<string, number>) {
  const out: any[] = [];
  for (const b of list) {
    const x0 = m.get(b.d0), x1 = m.get(b.d1);
    if (x0 === undefined || x1 === undefined || x1 <= x0) continue;
    out.push([x0, x1, b.zg, b.zd, b.label]);
  }
  return out;
}

/**
 * 量化信号日 → 当前周期 bar 索引：
 * 精确匹配 → 分钟线取当日第一根 → 周/月取"包含该日"的那根（向前 40 天内最近的 bar）
 */
function mapSignalIndex(day: string, klines: { day: string }[]): number {
  for (let i = 0; i < klines.length; i++) if (klines[i].day === day) return i;
  for (let i = 0; i < klines.length; i++) if (klines[i].day.startsWith(day)) return i;
  const t = new Date(day.replace(/-/g, '/')).getTime();
  if (Number.isFinite(t)) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < klines.length; i++) {
      const bt = new Date(klines[i].day.replace(/-/g, '/')).getTime();
      if (Number.isFinite(bt) && bt <= t && t - bt < 40 * 86400000 && t - bt < bestDist) {
        bestDist = t - bt;
        best = i;
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function boxRenderer(fill: string, lineCol: string) {
  return (_params: any, api: any) => {
    const p0 = api.coord([api.value(0), api.value(2)]);
    const p1 = api.coord([api.value(1), api.value(3)]);
    const w = Math.max(p1[0] - p0[0], 2);
    const h = Math.abs(p1[1] - p0[1]) || 2;
    return {
      type: 'rect',
      shape: { x: p0[0], y: Math.min(p0[1], p1[1]), width: w, height: h },
      style: { fill, stroke: lineCol, lineWidth: 1.2 },
      textConfig: { position: 'insideTopLeft', distance: 2 },
      textContent: {
        type: 'text',
        style: { text: String(api.value(4) ?? ''), fill: lineCol, font: '10px sans-serif' },
      },
    };
  };
}

/** MA(n)，返回与 closes 等长的数组（前 n-1 位为 null） */
export function maSeries(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= n) sum -= closes[i - n];
    out.push(i >= n - 1 ? Math.round((sum / n) * 1000) / 1000 : null);
  }
  return out;
}

/**
 * 组装完整 ECharts option。
 * @param zoom 默认窗口 { start, end }（百分比；keepZoom 由调用方从旧实例读取后传入）
 */
export function buildOption(
  klines: KLine[],
  draw: ChanDraw | null,
  t: ChartToggles,
  zoom: { start: number | null; end: number | null },
): Record<string, any> {
  // 空数据（组件挂载早于首次行情加载）时返回空 option，避免崩溃
  if (!klines.length) return { series: [] };
  const d = draw;
  const days = klines.map((k) => k.day);
  const candles = klines.map((k) => [k.open, k.close, k.low, k.high]);
  const vols = klines.map((k, i) => ({
    value: k.volume,
    itemStyle: { color: k.close >= (klines[i - 1]?.close ?? k.open) ? C.up : C.down },
  }));
  const macd = d?.macd;
  const hist = (macd?.hist ?? []).map((v) => ({
    value: v, itemStyle: { color: v >= 0 ? C.up : C.down },
  }));
  // 默认展示最后 ~120 根（密度适中）
  const startPct = Math.max(0, (1 - 120 / Math.max(klines.length, 1)) * 100);
  const m = new Map<string, number>();
  klines.forEach((k, i) => { if (!m.has(k.day)) m.set(k.day, i); });

  const mkLine = (rows: any[][], color: string, width: number, dashed: boolean, name: string) => ({
    name, type: 'line', data: toLineData(rows, m), symbol: 'none', silent: true, z: 8,
    xAxisIndex: 0, yAxisIndex: 0,
    lineStyle: { color, width, type: dashed ? 'dashed' : 'solid' },
    emphasis: { disabled: true },
  });
  const mkBox = (list: ChanBox[], fill: string, line: string, name: string) => ({
    name, type: 'custom', renderItem: boxRenderer(fill, line), silent: true, z: 6,
    data: boxToRect(list, m),
    encode: { x: [0, 1], y: [2, 3] }, xAxisIndex: 0, yAxisIndex: 0,
  });

  const grids: any[] = t.showVol && t.showMacd
    ? [{ left: 45, right: 15, top: '4%', height: '45%' }, { left: 45, right: 15, top: '57%', height: '13%' }, { left: 45, right: 15, top: '76%', height: '11%' }]
    : [{ left: 45, right: 15, top: '5%', height: '57%' }, { left: 45, right: 15, top: '73%', height: '16%' }];

  const series: any[] = [
    {
      name: 'K线', type: 'candlestick', data: candles, xAxisIndex: 0, yAxisIndex: 0, z: 2,
      itemStyle: {
        color: C.up, color0: C.down,
        borderColor: C.up, borderColor0: C.down, borderWidth: 1,
      },
      // 现价横虚线已按需求移除

    },
  ];
  if (d && t.showMa) {
    ([['MA5', 5, C.ma5], ['MA10', 10, C.ma10], ['MA20', 20, C.ma20], ['MA60', 60, C.ma60]] as const).forEach(([nm, n, col]) => {
      const closes = klines.map((k) => k.close);
      series.push({
        name: nm, type: 'line', data: maSeries(closes, n), symbol: 'none', silent: true, z: 4,
        xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { color: col, width: 1 },
        emphasis: { disabled: true },
      });
    });
  }
  if (d && t.showStroke) {
    series.push(mkLine(d.stroke, C.stroke, 1.8, false, '笔'));
    if (d.vstroke.length) series.push(mkLine(d.vstroke, C.stroke, 1.8, true, '虚笔'));
  }
  if (d && t.showSegment) {
    series.push(mkLine(d.segment, C.segment, 1.6, false, '线段'));
    if (d.vsegment.length) series.push(mkLine(d.vsegment, C.segment, 1.6, true, '虚段'));
  }
  if (d && t.showTrend) {
    series.push(mkLine(d.trend, C.trend, 2.5, false, '走势'));
    if (d.vtrend.length) series.push(mkLine(d.vtrend, C.trend, 2.5, true, '虚走势'));
    // 走势类型标注（上涨趋势/下跌趋势/中枢扩展）——带背景框更醒目
    if (d.trendMarks?.length) {
      const mm = new Map<string, number>();
      klines.forEach((k, i) => { if (!mm.has(k.day)) mm.set(k.day, i); });
      series.push({
        name: '走势标注', type: 'scatter', xAxisIndex: 0, yAxisIndex: 0, z: 11, silent: true,
        symbolSize: 0.1,
        label: {
          show: true, position: 'top', fontSize: 11, fontWeight: 700,
          padding: [3, 6, 3, 6], borderRadius: 3,
          backgroundColor: (p: any) => (String(p.data[2]).includes('上涨') ? 'rgba(236,0,0,0.10)' : String(p.data[2]).includes('下跌') ? 'rgba(0,218,96,0.10)' : 'rgba(136,144,152,0.12)'),
          color: (p: any) => (String(p.data[2]).includes('上涨') ? C.up : String(p.data[2]).includes('下跌') ? '#00a854' : '#889098'),
          formatter: (p: any) => p.data[2],
        },
        data: d.trendMarks
          .map((tm) => { const idx = mm.get(tm.day); return idx === undefined ? null : [idx, tm.price, tm.text]; })
          .filter(Boolean),
      });
    }
  }
  if (d && t.showPivot) {
    series.push(mkBox(d.strokebox, C.strokeBoxFill, C.strokeBoxLine, '笔中枢'));
    series.push(mkBox(d.segmentbox, C.segBoxFill, C.segBoxLine, '段中枢'));
  }
  if (d && t.showMarkers && d.markers.length) {
    // 买点显示在K线下方，卖点显示在K线上方
    const buys = d.markers.filter((m) => m.type.startsWith('B'));
    const sells = d.markers.filter((m) => !m.type.startsWith('B'));
    const mkData = (list: typeof d.markers) =>
      list.map((mk) => { const idx = m.get(mk.day); return idx === undefined ? null : [idx, mk.price, mk.day, mk.type, mk.label]; }).filter(Boolean);
    const mkSeries = (data: any[], color: string, position: string, name: string) => ({
      name, type: 'scatter', xAxisIndex: 0, yAxisIndex: 0, z: 10,
      symbolSize: 9, cursor: 'pointer',
      emphasis: { scale: 1.6 },
      itemStyle: { color },
      label: {
        show: true, position, fontSize: 9,
        color,
        formatter: (p: any) => p.data[4],
      },
      data,
    });
    if (buys.length) series.push(mkSeries(mkData(buys), C.up, 'bottom', '买点'));
    if (sells.length) series.push(mkSeries(mkData(sells), C.down, 'top', '卖点'));
  }
  const volIdx = 1;
  const macdIdx = t.showVol && t.showMacd ? 2 : 1;
  if (t.showVol) {
    series.push({ name: 'VOL', type: 'bar', data: vols, xAxisIndex: volIdx, yAxisIndex: volIdx, silent: true, z: 2 });
  }
  if (t.showMacd && macd) {
    series.push({ name: 'MACD', type: 'bar', data: hist, xAxisIndex: macdIdx, yAxisIndex: macdIdx, silent: true, z: 2 });
    series.push({ name: 'DIF', type: 'line', data: macd.dif, symbol: 'none', silent: true, xAxisIndex: macdIdx, yAxisIndex: macdIdx, lineStyle: { color: C.dif, width: 1 }, z: 3 });
    series.push({ name: 'DEA', type: 'line', data: macd.dea, symbol: 'none', silent: true, xAxisIndex: macdIdx, yAxisIndex: macdIdx, lineStyle: { color: C.dea, width: 1 }, z: 3 });
  }
  // 通达信公式输出线（主图叠加；信号线画在收盘价位置的点标记）
  const TDX_COLORS = ['#e91e63', '#00bcd4', '#795548', '#3f51b5', '#ff5722', '#607d8b'];
  if (t.tdxLines?.length) {
    const closeArr = klines.map((k) => k.close);
    let ci = 0;
    for (const ln of t.tdxLines) {
      if (ln.signal) {
        series.push({
          name: ln.name, type: 'scatter', xAxisIndex: 0, yAxisIndex: 0, z: 9, silent: true,
          symbol: 'diamond', symbolSize: 8,
          itemStyle: { color: TDX_COLORS[ci % TDX_COLORS.length] },
          label: { show: true, position: 'bottom', fontSize: 9, color: TDX_COLORS[ci % TDX_COLORS.length], formatter: ln.name },
          data: ln.values.map((v, i) => (v === 1 ? [i, closeArr[i]] : null)).filter(Boolean),
        });
      } else {
        series.push({
          name: ln.name, type: 'line', data: ln.values, symbol: 'none', silent: true, z: 7,
          xAxisIndex: 0, yAxisIndex: 0,
          lineStyle: { color: TDX_COLORS[ci % TDX_COLORS.length], width: 1.2, type: 'dashed' },
        });
      }
      ci++;
    }
  }
  // 量化策略演示信号（独立于缠论买卖点，紫=买/橙=卖，居中菱形标记）
  if (t.quantMarks?.length) {
    series.push({
      name: '量化信号', type: 'scatter', xAxisIndex: 0, yAxisIndex: 0, z: 12,
      symbol: 'diamond', symbolSize: 9, cursor: 'pointer',
      emphasis: { scale: 1.6 },
      itemStyle: { color: (p: any) => (String(p.data[2]) === 'B' ? '#8e44ad' : '#ff9800') },
      data: t.quantMarks
        .map((mk) => { const idx = mapSignalIndex(mk.day, klines); return idx < 0 ? null : [idx, mk.price, mk.dir]; })
        .filter(Boolean),
    });
  }

  const mkX = (gridIdx: number, showLabel: boolean) => ({
    type: 'category', data: days, gridIndex: gridIdx, boundaryGap: true,
    axisLine: { show: true, lineStyle: { color: '#dee2e6', width: 1 }, onZero: false, symbol: ['none', 'none'] },
    axisTick: { show: true, length: 5, interval: 'auto' },
    axisLabel: showLabel
      ? { color: '#6c757d', fontSize: 10, margin: 8, formatter: (v: string) => v.replace(/^\d{4}-/, '').replace(' ', '\n') }
      : { show: false },
    splitLine: { show: true, lineStyle: { color: '#f8f9fa', width: 1 } },
    axisPointer: {
      show: t.showCursor,
      label: { show: t.showCursor, backgroundColor: '#e9ecef', color: '#495057', borderRadius: 3, padding: [4, 6, 4, 6], fontSize: 10 },
    },
  });
  const mkY = (gridIdx: number, small: boolean) => ({
    scale: true, gridIndex: gridIdx,
    name: gridIdx === 0 ? t.currencyAxis : '',
    nameTextStyle: { color: '#6c757d', fontSize: 10, align: 'right', padding: [0, 2, 0, 0] },
    nameGap: 6,
    axisLine: { show: false },
    axisLabel: { color: '#6c757d', fontSize: small ? 10 : 11, margin: 8 },
    splitLine: { show: true, lineStyle: { color: '#f8f9fa', width: 1, type: 'dashed' } },
    axisPointer: {
      show: t.showCursor,
      label: { show: t.showCursor, backgroundColor: '#e9ecef', color: '#495057', borderRadius: 3, padding: [4, 6, 4, 6], fontSize: 10, precision: 2 },
    },
  });
  const xAxis: any[] = grids.map((_: any, i: number) => mkX(i, i === 0));
  const yAxis: any[] = grids.map((_: any, i: number) => mkY(i, i > 0));

  return {
    animation: false,
    backgroundColor: '#ffffff',
    textStyle: { fontFamily: 'Microsoft YaHei', fontSize: 12 },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      animation: false,
      label: { backgroundColor: '#e9ecef', color: '#495057', borderRadius: 3, padding: [5, 7, 5, 7], margin: 3 },
      lineStyle: { color: '#adb5bd', width: 1, type: 'dashed' },
      crossStyle: { color: '#adb5bd', width: 1, type: 'dashed' },
    },
    tooltip: {
      show: false,
      trigger: 'axis',
      axisPointer: { type: 'cross', animation: false, crossStyle: { color: '#adb5bd', width: 1, type: 'dashed' } },
    },
    grid: grids,
    xAxis, yAxis,
    dataZoom: [
      { type: 'inside', xAxisIndex: xAxis.map((_, i) => i), start: zoom.start ?? startPct, end: zoom.end ?? 100 },
      {
        type: 'slider', xAxisIndex: xAxis.map((_, i) => i), start: zoom.start ?? startPct, end: zoom.end ?? 100,
        // 底部预留标签空间：滑条下缘的时间范围文字不再被裁切
        bottom: 12, height: 22, borderColor: '#e9ecef', backgroundColor: '#fafbfc',
        fillerColor: 'rgba(24,144,255,0.14)',
        handleIcon: 'path://M-4,0L4,0 M0,-4L0,4', handleSize: '60%',
        handleStyle: { color: '#fff', borderColor: '#adb5bd' },
        labelFormatter: (v: number, val: string) => (val || '').slice(5), // 只显示 月-日，去掉年份前缀
        textStyle: { color: '#adb5bd', fontSize: 9 },
        dataBackground: { lineStyle: { color: '#dee2e6' }, areaStyle: { color: 'rgba(222,226,230,0.35)' } },
        selectedDataBackground: { lineStyle: { color: '#1890ff' }, areaStyle: { color: 'rgba(24,144,255,0.15)' } },
      },
    ],
    series,
  };
}
