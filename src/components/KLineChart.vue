<template>
  <view class="kline-wrap" :class="{ 'kline-fullscreen': fullscreen }">
    <!-- 顶部 OHLC 信息栏（替代浮动提示框，跟随十字光标） -->
    <view v-if="hoverInfo" class="ohlc-bar">
      <text class="ohlc-date">{{ hoverInfo.day }}</text>
      <text class="ohlc-item">开 <b :class="hoverInfo.cls">{{ hoverInfo.open }}</b></text>
      <text class="ohlc-item">高 <b :class="hoverInfo.cls">{{ hoverInfo.high }}</b></text>
      <text class="ohlc-item">低 <b :class="hoverInfo.cls">{{ hoverInfo.low }}</b></text>
      <text class="ohlc-item">收 <b :class="hoverInfo.cls">{{ hoverInfo.close }}</b><text class="ohlc-unit">{{ currencySuffix }}</text></text>
      <text class="ohlc-item" :class="hoverInfo.cls">{{ hoverInfo.chgText }}</text>
      <text v-if="hoverIdx >= 0" class="ohlc-vol">量 {{ hoverInfo.vol }}</text>
      <text v-if="hoverInfo.macdText && hoverIdx >= 0" class="ohlc-macd">{{ hoverInfo.macdText }}</text>
      <text v-if="hoverInfo.maText && hoverIdx >= 0" class="ohlc-ma">{{ hoverInfo.maText }}</text>
    </view>
    <!-- #ifdef H5 -->
    <div ref="chartEl" class="kline-el"></div>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <MpEchart class="kline-el" :option="currentOption" @inited="onMpInited" />
    <!-- #endif -->
    <!-- 触屏十字线：交点只在主图内，竖线向下贯穿 VOL / MACD 副图 -->
    <view v-if="crosshair && crosshair.inGrid" class="touch-cross"
          :style="{ left: crosshair.gx + 'px', top: crosshair.gy + 'px', width: crosshair.gw + 'px', height: crosshair.fullH + 'px' }">
      <view class="cross-v" :style="{ left: crosshair.x + 'px' }" />
      <view class="cross-h" :style="{ top: crosshair.y + 'px' }" />
      <view class="cross-y-label" :style="{ top: (crosshair.y - 9) + 'px' }">{{ crosshair.price }}</view>
      <view class="cross-x-label" :style="{ left: crosshair.x + 'px', top: (crosshair.gh + 2) + 'px' }">{{ crosshair.day }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 缠论K线图（双端）
 * H5：echarts.init(div) + 原生鼠标拖拽平移
 * 微信小程序：MpEchart 容器（canvas 2d + 触摸转发），手势经 inside dataZoom
 * 绘制配置统一由 buildOption() 纯函数组装（klineOption.ts）
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';
import * as echarts from 'echarts/core';
import { CandlestickChart, LineChart, BarChart, CustomChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, AxisPointerComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { buildOption } from './klineOption';
import type { KLine } from '../api/cnfin';
import type { ChanDraw } from '../chan/types';
// #ifdef MP-WEIXIN
import MpEchart from './MpEchart.vue';
// #endif

echarts.use([
  CandlestickChart, LineChart, BarChart, CustomChart, ScatterChart,
  GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, AxisPointerComponent,
  CanvasRenderer,
]);

const props = withDefaults(defineProps<{
  klines: KLine[];
  draw: ChanDraw | null;
  showStroke?: boolean;
  showSegment?: boolean;
  showPivot?: boolean;
  showTrend?: boolean;
  showVol?: boolean;
  showMacd?: boolean;
  showMa?: boolean;
  showMarkers?: boolean;
  showCursor?: boolean;
  /** 货币单位（Y轴顶部与信息栏）：元/港元/美元/点 */
  currencySuffix?: string;
  /** Y轴短符号：¥/HK$/US$ */
  currencyAxis?: string;
  /** 通达信公式输出线 */
  tdxLines?: { name: string; values: (number | null)[]; signal?: boolean }[];
  /** 量化策略演示信号（B=买 S=卖） */
  quantMarks?: { day: string; price: number; dir: 'B' | 'S' }[];
  fullscreen?: boolean;
}>(), {
  showStroke: true, showSegment: false, showPivot: true, showTrend: false,
  showVol: true, showMacd: false, showMa: false, showMarkers: true, showCursor: true,
  currencySuffix: '', currencyAxis: '', tdxLines: undefined, quantMarks: undefined, fullscreen: false,
});

const chartEl = ref<any>(null);
let chart: echarts.ECharts | null = null;      // H5 实例
let mpChart: echarts.ECharts | null = null;    // 小程序实例（包装组件回传）
let ro: ResizeObserver | null = null;
let dragCleanup: (() => void) | null = null;
const inst = getCurrentInstance();

const currentOption = ref<any>(null);

/* 悬停信息栏：默认显示最新一根，鼠标/触摸移动时跟随 */
const hoverIdx = ref(-1);
/** 当前被 emphasize 高亮的 K 线柱索引（触屏用，桌面由 ECharts 自动管理） */
let highlightIdx = -1;
/** 触屏十字线（相对图表容器的像素坐标 + 对应数值），自绘覆盖层 */
const crosshair = ref<{
  x: number; y: number; gx: number; gy: number; gw: number; gh: number;
  fullH: number; inGrid: boolean; price: string; day: string;
} | null>(null);
const hoverInfo = computed(() => {
  const ks = props.klines;
  if (!ks.length) return null;
  const i = hoverIdx.value >= 0 && hoverIdx.value < ks.length ? hoverIdx.value : ks.length - 1;
  const k = ks[i];
  const prev = ks[i - 1] ?? k;
  const up = k.close >= prev.close;
  const chg = prev.close ? Math.round(((k.close - prev.close) / prev.close) * 10000) / 100 : 0;
  const diff = Math.round((k.close - prev.close) * 100) / 100;
  const sign = diff >= 0 ? '+' : '';
  const vol = k.volume >= 1e8 ? (k.volume / 1e8).toFixed(2) + '亿'
    : k.volume >= 1e4 ? (k.volume / 1e4).toFixed(2) + '万' : String(k.volume);
  let macdText = '';
  if (props.showMacd && props.draw?.macd) {
    const md = props.draw.macd;
    const f = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '--' : Math.round(v * 100) / 100);
    const h = md.hist[i];
    macdText = `DIF ${f(md.dif[i])} DEA ${f(md.dea[i])} MACD ${f(h)}`;
  }
  let maText = '';
  if (props.showMa) {
    const closes = props.klines.map((x) => x.close);
    const maVal = (nn: number): number | null => (i < nn - 1 ? null : closes.slice(i - nn + 1, i + 1).reduce((a, b) => a + b, 0) / nn);
    const f = (v: number | null) => (v === null ? '--' : Math.round(v * 100) / 100);
    maText = `MA5 ${f(maVal(5))} MA10 ${f(maVal(10))} MA20 ${f(maVal(20))} MA60 ${f(maVal(60))}`;
  }
  return {
    day: k.day,
    open: k.open, high: k.high, low: k.low, close: k.close,
    cls: up ? 'ohlc-up' : 'ohlc-down',
    chgText: `${sign}${diff} ${sign}${chg}%`,
    vol,
    macdText,
    maText,
  };
});

function getInst(): echarts.ECharts | null {
  return chart || mpChart;
}

/** 组装并应用 option。keepZoom=true 保留当前缩放（开关切换），数据变化时重置默认窗口 */
function applyOption(keepZoom = false) {
  highlightIdx = -1;
  crosshair.value = null;
  // 空数据时也应用空 option：复权/换标的清空阶段，图面变白让"刷新"肉眼可见
  if (!props.klines.length) {
    const g0 = getInst();
    if (g0) g0.setOption({ series: [] }, true);
    return;
  }
  const g = getInst();
  const prevZoom = keepZoom && g ? g.getOption().dataZoom?.[0] : null;
  const option = buildOption(props.klines, props.draw, {
    showStroke: props.showStroke, showSegment: props.showSegment, showPivot: props.showPivot,
    showTrend: props.showTrend, showVol: props.showVol, showMacd: props.showMacd,
    showMa: props.showMa, showMarkers: props.showMarkers, showCursor: props.showCursor,
    currencySuffix: props.currencySuffix, currencyAxis: props.currencyAxis,
    tdxLines: props.tdxLines, quantMarks: props.quantMarks,
  }, { start: prevZoom?.start ?? null, end: prevZoom?.end ?? null });
  currentOption.value = option;
  if (chart) chart.setOption(option, true);
}

function bindHover() {
  const g = getInst();
  if (!g) return;
  const zr = (g as any).getZr();
  const updateHover = (e: any) => {
    try {
      const x = e.offsetX ?? e.zrX;
      const y = e.offsetY ?? e.zrY;
      if (x === undefined || y === undefined) return;
      const idx = Math.round((g as any).convertFromPixel({ gridIndex: 0 }, [x, y])[0]);
      if (idx >= 0 && idx < props.klines.length) hoverIdx.value = idx;
    } catch { /* 忽略越界 */ }
  };
  // 桌面鼠标 + 手机触摸统一处理
  zr.on('mousemove', updateHover);
  zr.on('touchstart', updateHover);
  zr.on('touchmove', updateHover);
  // 点击买卖点/量化标记 → 通知页面弹出详情
  g.on('click', (p: any) => {
    if ((p.seriesName === '买点' || p.seriesName === '卖点') && p.data) {
      const [/*idx*/, /*price*/, day, type] = p.data;
      const mk = props.draw?.markers.find((m) => m.day === day && m.type === type);
      if (mk) uni.$emit('cl-marker', mk);
      return;
    }
    if (p.seriesName === '量化信号' && p.data) {
      const [/*idx*/, price, dir] = p.data;
      const idx = p.data[0];
      const day = props.klines[idx]?.day ?? '';
      uni.$emit('cl-quant', { day, price, dir });
    }
  });
  zr.on('mouseout', () => { hoverIdx.value = -1; });
  zr.on('dblclick', resetWindow);
}

/** 主图 grid 的像素矩形（相对图表容器），十字线交点只在其中 */
function getGridRect() {
  try {
    const cs = (chart as any)?.getModel?.().getComponent('grid', 0)?.coordinateSystem;
    const r = cs?.getRect?.();
    if (r && r.width > 0 && r.height > 0) return { x: r.x, y: r.y, w: r.width, h: r.height };
  } catch { /* ignore */ }
  try {
    const dom = (chart as any)?.getDom?.();
    if (dom && dom.clientWidth > 0) {
      const W = dom.clientWidth, H = dom.clientHeight;
      return { x: 45, y: H * 0.12, w: W - 60, h: H * 0.5 };
    }
  } catch { /* ignore */ }
  return null;
}

/** 所有副图（VOL / MACD）最底部，竖线延伸到这里 */
function getPlotBottom(fallback: number) {
  try {
    let b = 0;
    (chart as any)?.getModel?.().eachComponent?.('grid', (gm: any) => {
      const r = gm?.coordinateSystem?.getRect?.();
      if (r && Number.isFinite(r.y) && Number.isFinite(r.height)) b = Math.max(b, r.y + r.height);
    });
    if (b > 0) return b;
  } catch { /* ignore */ }
  return fallback;
}

/** 触摸点 → 自绘十字线 + 当前 K 线柱高亮（桌面端仍由 ECharts 自身 mousemove 驱动） */
function setHover(x: number, y: number) {
  if (!chart) return;
  let idx = -1;
  let price = '';
  try {
    const p = (chart as any).convertFromPixel({ gridIndex: 0 }, [x, y]);
    const v = Math.round(p[0]);
    if (v >= 0 && v < props.klines.length) idx = v;
    if (Number.isFinite(p[1])) price = String(Math.round(p[1] * 100) / 100);
  } catch { /* ignore */ }
  const g = getGridRect();
  const gx = g?.x ?? 45, gy = g?.y ?? 0, gw = g?.w ?? 0, gh = g?.h ?? 0;
  const domH = (chart as any)?.getDom?.()?.clientHeight ?? 0;
  const plotBottom = getPlotBottom(Math.max(gy + gh, domH - 40));
  const fullH = Math.max(gh, plotBottom - gy);
  const rx = x - gx, ry = y - gy;
  const inGrid = !!g && rx >= 0 && rx <= gw && ry >= 0 && ry <= gh;
  crosshair.value = {
    x: rx, y: ry, gx, gy, gw, gh, fullH, inGrid, price,
    day: idx >= 0 ? String(props.klines[idx].day).slice(5) : '',
  };
  if (idx >= 0 && inGrid) {
    hoverIdx.value = idx;
    if (idx !== highlightIdx) {
      if (highlightIdx >= 0) chart.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: highlightIdx });
      chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
      highlightIdx = idx;
    }
  }
}

/** 手机点选买卖点 / 量化信号：26px 容差，绕开 ECharts 小圆点难以命中的问题 */
function hitSignal(x: number, y: number): boolean {
  if (!chart) return false;
  const idxOf = (day: string) => props.klines.findIndex((k) => k.day === day);
  const near = (idx: number, price: number) => {
    if (idx < 0) return false;
    try {
      const p = (chart as any).convertToPixel({ gridIndex: 0 }, [idx, price]);
      return !!p && Math.hypot(p[0] - x, p[1] - y) <= 26;
    } catch { return false; }
  };
  // 买卖点开关关闭时图上不画标记，也不允许点出详情
  if (props.showMarkers) {
    for (const mk of props.draw?.markers ?? []) {
      if (near(idxOf(mk.day), mk.price)) { uni.$emit('cl-marker', mk); return true; }
    }
  }
  for (const mk of props.quantMarks ?? []) {
    if (near(idxOf(mk.day), mk.price)) {
      uni.$emit('cl-quant', { day: mk.day, price: mk.price, dir: mk.dir });
      return true;
    }
  }
  return false;
}

/** 手机触摸：上下滑滚页面，水平跟随十字线+平移，底部滑块可拖，双指缩放 */
function bindMobileTouch(el: HTMLElement) {
  let startX = 0, startY = 0, lastX = 0, lastDist = 0, touching = false;
  let mode: 'pending' | 'inspect' | 'scroll' | 'slider' = 'pending';
  let slider: { start: number; end: number; anchorX: number; part: 'left' | 'right' | 'move' } | null = null;
  const getPos = (t: Touch) => {
    const rect = el.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  // 底部 dataZoom 滑块：bottom:10 / height:30 → [H-40, H-10]，上下各放宽 6px
  const inSliderBand = (y: number) => y >= el.clientHeight - 46 && y <= el.clientHeight - 4;
  const pctAt = (x: number) => {
    const x0 = 45, x1 = Math.max(x0 + 1, el.clientWidth - 15);
    return Math.max(0, Math.min(100, ((x - x0) / (x1 - x0)) * 100));
  };
  const beginSlider = (x: number) => {
    try {
      const all = (chart as any)?.getOption().dataZoom ?? [];
      const dz = all[1] ?? all[0];
      if (!dz) return false;
      const pct = pctAt(x), tol = 9;
      let part: 'left' | 'right' | 'move' = 'move';
      if (Math.abs(pct - dz.start) < tol) part = 'left';
      else if (Math.abs(pct - dz.end) < tol) part = 'right';
      else if (pct > dz.start && pct < dz.end) part = 'move';
      else part = pct < dz.start ? 'left' : 'right';
      slider = { start: dz.start, end: dz.end, anchorX: x, part };
      return true;
    } catch { return false; }
  };
  const moveSlider = (x: number) => {
    if (!slider || !chart) return;
    const delta = pctAt(x) - pctAt(slider.anchorX);
    let s = slider.start, e = slider.end;
    if (slider.part === 'left') s = Math.max(0, Math.min(e - 2, s + delta));
    else if (slider.part === 'right') e = Math.min(100, Math.max(s + 2, e + delta));
    else {
      const span = e - s;
      s = Math.max(0, Math.min(100 - span, s + delta));
      e = s + span;
    }
    chart.dispatchAction({ type: 'dataZoom', start: s, end: e });
  };
  el.addEventListener('touchstart', (ev: TouchEvent) => {
    if (ev.touches.length === 1) {
      const p = getPos(ev.touches[0]);
      if (inSliderBand(p.y)) {
        mode = 'slider';
        if (!beginSlider(p.x)) mode = 'pending';
        touching = mode === 'slider';
        return;
      }
      if (hitSignal(p.x, p.y)) { touching = false; return; }
      touching = true;
      mode = 'pending';
      startX = p.x; startY = p.y; lastX = p.x;
      setHover(p.x, p.y);
    } else if (ev.touches.length === 2) {
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });
  el.addEventListener('touchmove', (ev: TouchEvent) => {
    if (ev.touches.length === 1 && touching) {
      const p = getPos(ev.touches[0]);
      if (mode === 'slider') { moveSlider(p.x); return; }
      const dx = Math.abs(p.x - startX);
      const dy = Math.abs(p.y - startY);
      if (mode === 'pending' && (dx > 6 || dy > 6)) {
        mode = dy > dx * 1.2 ? 'scroll' : 'inspect';
      }
      if (mode === 'scroll') return;
      setHover(p.x, p.y);
      const dpx = p.x - lastX;
      if (Math.abs(dpx) > 2) {
        panByPixels(dpx);
        lastX = p.x;
      }
    } else if (ev.touches.length === 2) {
      const dx = ev.touches[0].clientX - ev.touches[1].clientX;
      const dy = ev.touches[0].clientY - ev.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist > 0 && Math.abs(dist - lastDist) > 5) {
        zoomByPinch(dist / lastDist);
        lastDist = dist;
      }
    }
  }, { passive: true });
  const end = () => { touching = false; lastDist = 0; slider = null; };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

function zoomByPinch(ratio: number) {
  shiftWindow(1 / ratio, 0);
}

/* ---- 边界提示：拖/翻到数据尽头时告知用户，避免"无声卡住" ---- */
let lastBoundaryToast = 0;
function boundaryToast(edge: 'oldest' | 'newest') {
  const now = Date.now();
  if (now - lastBoundaryToast < 2000) return;
  lastBoundaryToast = now;
  const ks = props.klines;
  if (!ks.length) return;
  const day = edge === 'oldest' ? ks[0].day : ks[ks.length - 1].day;
  const label = edge === 'oldest' ? `已到最早数据（${day.slice(0, 10)}）` : `已是最新数据（${day.slice(0, 10)}）`;
  uni.showToast({ title: label, icon: 'none', duration: 1800 });
}

/** 按像素拖动平移（拖右=看更早，拖左=看更新） */
function panByPixels(dx: number) {
  const g = getInst();
  if (!g || !dx) return;
  const dz = g.getOption().dataZoom[0];
  if (!dz) return;
  const len = props.klines.length;
  const startIdx = Math.round((dz.start / 100) * len);
  const endIdx = Math.round((dz.end / 100) * len);
  const x0 = (g as any).convertToPixel({ gridIndex: 0 }, [startIdx, 0])[0];
  const x1 = (g as any).convertToPixel({ gridIndex: 0 }, [Math.min(endIdx, len - 1), 0])[0];
  const pxPerBar = (x1 - x0) / Math.max(1, endIdx - startIdx);
  if (!pxPerBar) return;
  const bars = Math.round(-dx / pxPerBar);
  if (!bars) return;
  const span = Math.max(2, Math.min(len, endIdx - startIdx));
  const newStart = Math.max(0, Math.min(len - span, startIdx + bars));
  if (newStart === startIdx) {
    boundaryToast(bars < 0 ? 'oldest' : 'newest');
    return;
  }
  g.dispatchAction({ type: 'dataZoom', start: (newStart / len) * 100, end: ((newStart + span) / len) * 100 });
}

/* ---- 缩放/平移控制（供页面 ＋－◀▶ 按钮调用） ---- */
function shiftWindow(zoomFactor: number, panPct: number) {
  const g = getInst();
  if (!g) return;
  const dz = g.getOption().dataZoom[0];
  if (!dz) return;
  const len = props.klines.length;
  const oldSpan = dz.end - dz.start;
  const newSpan = Math.max((2 / len) * 100, Math.min(100, oldSpan * zoomFactor));
  // 平移 + 缩放均围绕窗口中心
  const center = dz.start + oldSpan / 2 + panPct * oldSpan;
  const start = Math.max(0, Math.min(100 - newSpan, center - newSpan / 2));
  const startIdx = Math.max(0, Math.min(len - 2, Math.round((start / 100) * len)));
  const spanIdx = Math.max(2, Math.min(len - startIdx, Math.round((newSpan / 100) * len)));
  // 边界反馈：平移方向上已无数据可看时提示（缩放不提示）
  if (zoomFactor === 1 && panPct !== 0) {
    const newEndIdx = startIdx + spanIdx;
    const atOldest = startIdx === 0 && panPct < 0;
    const atNewest = newEndIdx >= len - 1 && panPct > 0;
    if (atOldest || atNewest) boundaryToast(atOldest ? 'oldest' : 'newest');
  }
  g.dispatchAction({ type: 'dataZoom', start: (startIdx / len) * 100, end: ((startIdx + spanIdx) / len) * 100 });
}
function zoomIn() { shiftWindow(0.6, 0); }
function zoomOut() { shiftWindow(1 / 0.6, 0); }
// ◀▶ 小步移动：每次平移当前窗口的 1/4（一步一步挪，便于精细回看）
function panLeft() { shiftWindow(1, -0.25); }
function panRight() { shiftWindow(1, 0.25); }
/** 复位：回到默认 120 根窗口 */
function resetWindow() {
  const g = getInst();
  if (!g) return;
  const len = props.klines.length;
  const n = Math.min(120, len);
  g.dispatchAction({ type: 'dataZoom', start: ((len - n) / len) * 100, end: 100 });
}

const onZoom = (dir: number) => (dir > 0 ? zoomIn() : zoomOut());
const onPan = (dir: number) => (dir > 0 ? panRight() : panLeft());

function resize() {
  // #ifdef H5
  chart?.resize();
  // #endif
}

// #ifdef H5
/** 拖拽平移（原生 DOM 鼠标事件；触摸端由 inside dataZoom 手势处理） */
function bindDrag(el: HTMLElement) {
  let dragging = false;
  let lastX = 0;
  const onMouseDown = (ev: MouseEvent) => { ev.preventDefault(); dragging = true; lastX = ev.clientX; el.style.cursor = 'grabbing'; };
  const onMouseMove = (ev: MouseEvent) => {
    if (!dragging) return;
    panByPixels(ev.clientX - lastX);
    lastX = ev.clientX;
  };
  const up = () => { dragging = false; el.style.cursor = ''; };
  el.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', up);
  dragCleanup = () => {
    el.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', up);
  };
}
// #endif

function onMpInited(instance: any) {
  mpChart = instance;
  bindHover();
  applyOption(true);
}

onMounted(async () => {
  // #ifdef H5
  try {
    const el = chartEl.value?.$el ?? chartEl.value ?? (inst?.proxy?.$refs as any)?.chartEl;
    if (!el) { (window as any).__mountErr = 'el is null'; return; }
    const htmlEl = el as HTMLElement;
    // 等待 CSS 布局给出正确高度（.kline-el height:100% 跟随父容器 flex/固定高）
    for (let i = 0; i < 30; i++) {
      if (htmlEl.clientHeight > 10) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const initW = htmlEl.clientWidth > 10 ? htmlEl.clientWidth : 380;
    const initH = htmlEl.clientHeight > 10 ? htmlEl.clientHeight : 480;
    chart = echarts.init(htmlEl, null, { width: initW, height: initH });
    (window as any).__chart = chart;
    applyOption(false);
    bindHover();
    if (!('ontouchstart' in window)) {
      bindDrag(htmlEl);
    }
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(htmlEl);
    }
    window.addEventListener('resize', resize);
    bindMobileTouch(htmlEl);
  } catch (e: any) {
    (window as any).__mountErr = (e && e.stack ? String(e.stack).slice(0, 300) : String(e));
  }
  // #endif
});

watch(
  () => [props.klines, props.draw, props.currencySuffix, props.currencyAxis, props.tdxLines, props.quantMarks],
  () => nextTick(() => { resize(); applyOption(false); }),
  { deep: false },
);
watch(
  () => [props.showStroke, props.showSegment, props.showPivot, props.showTrend, props.showVol, props.showMacd, props.showMa, props.showMarkers, props.showCursor, props.fullscreen],
  () => nextTick(() => { resize(); applyOption(true); }),
  { deep: false },
);

onBeforeUnmount(() => {
  uni.$off('cl-zoom', onZoom);
  uni.$off('cl-pan', onPan);
  // #ifdef H5
  dragCleanup?.();
  dragCleanup = null;
  ro?.disconnect();
  ro = null;
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = null;
  // #endif
  mpChart = null;
});

defineExpose({ resize, zoomIn, zoomOut, panLeft, panRight, resetWindow });
</script>

<style scoped>
/* 垂直方向交还浏览器滚动页面；水平方向由 JS 处理十字线 */
/* 外层 .kline-wrap 不设，保持页面可以滚动 */
.kline-el,
.kline-el canvas {
  touch-action: pan-y;
}
.kline-wrap {
  width: 100%;
  height: 100%;
  position: relative;
}
.kline-el {
  width: 100%;
  height: 100%;
}
/* 顶部 OHLC 信息栏 */
.ohlc-bar {
  position: absolute;
  top: 0;
  left: 45px;
  right: 15px;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 10px;
  line-height: 1.6;
  color: #6c757d;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.92);
  padding: 1px 4px;
}
.ohlc-date { color: #212529; font-weight: 600; }
.ohlc-item b { font-weight: 600; }
.ohlc-unit { font-size: 9px; color: #999; font-weight: 400; margin-left: 1px; }
.ohlc-up { color: #ec0000; }
.ohlc-down { color: #00da60; }
.ohlc-vol { color: #999; }
.ohlc-macd { color: #9c27b0; }
.ohlc-ma { color: #1e90ff; }

/* 触屏自绘十字线：DOM 覆盖层，跟随手指，不受 ECharts 重绘影响 */
.touch-cross {
  /* 尺寸由 setHover 按主图 grid 矩形动态给出，十字线不会延伸到副图与滑块区 */
  position: absolute;
  pointer-events: none;
  z-index: 15;
}
.cross-v {
  position: absolute;
  top: 0; bottom: 0; width: 0;
  border-left: 1px dashed #8a94a6;
}
.cross-h {
  position: absolute;
  left: 0; right: 0; height: 0;
  border-top: 1px dashed #8a94a6;
}
.cross-y-label,
.cross-x-label {
  position: absolute;
  background: #e9ecef;
  color: #495057;
  font-size: 10px;
  line-height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
}
.cross-y-label { left: 0; }
.cross-x-label { transform: translateX(-50%); }
</style>
