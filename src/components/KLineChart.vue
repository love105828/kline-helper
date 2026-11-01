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
    // 等待 CSS 布局给出正确高度（不写死，让 flex 自适应竖屏/横屏）
    for (let i = 0; i < 30; i++) {
      if (htmlEl.clientHeight > 10) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const initW = htmlEl.clientWidth > 10 ? htmlEl.clientWidth : 380;
    const initH = htmlEl.clientHeight > 10 ? htmlEl.clientHeight : 500;
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
.kline-wrap,
.kline-el,
.kline-el canvas {
  touch-action: none;
}
.kline-wrap {
  width: 100%;
  height: 100%;
  position: relative;
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
</style>
