<template>
  <view class="page">
    <!-- 报价头 -->
    <view class="quote-head" v-if="real">
      <text class="quote-name">{{ name }}</text>
      <text class="quote-price" :class="real.change >= 0 ? 'up' : 'down'">{{ real.last }}</text>
      <text class="quote-currency">{{ cur.suffix }}</text>
      <text class="quote-sub" :class="real.change >= 0 ? 'up' : 'down'">
        {{ real.change >= 0 ? '+' : '' }}{{ real.change }} ({{ real.changeRate >= 0 ? '+' : '' }}{{ real.changeRate }}%)
      </text>
      <view class="mode-toggle" @click="toggleMode">{{ isLandscape ? '⤢ 竖屏' : '⤢ 横屏' }}</view>
    </view>

    <!-- 量化演示条（与主页共用 CL_QUANT_DEMO 存储） -->
    <view v-if="quantDemo" class="quant-bar" @click="quantVisible = !quantVisible">
      <text class="quant-text">🎯 {{ quantDemo.name }}（{{ quantVisible ? '演示中' : '已隐藏' }}）· 交易 {{ quantDemo.stats.trades }} 次 · 胜率 {{ quantDemo.stats.winRate }}%</text>
      <text class="quant-op">{{ quantVisible ? '隐藏' : '显示' }}</text>
    </view>

    <!-- 周期 tabs -->
    <view class="period-row">
      <view
        v-for="p in periods"
        :key="p"
        class="period-item"
        :class="{ active: period === p }"
        @click="switchPeriod(p)"
      >{{ periodLabels[p] }}</view>
      <view class="period-item exit" @click="goBack">退出</view>
    </view>

    <!-- 图表 -->
    <view class="chart-area">
      <KLineChart
        :klines="klines"
        :draw="draw"
        :show-stroke="prefs.showStroke"
        :show-segment="prefs.showSegment"
        :show-pivot="prefs.showPivot"
        :show-trend="prefs.showTrend"
        :show-vol="prefs.showVol"
        :show-macd="prefs.showMacd"
        :show-ma="prefs.showMa"
        :currency-suffix="cur.suffix"
        :currency-axis="cur.axis"
        :quant-marks="quantDemo && quantVisible ? quantDemo.marks : undefined"
      />
      <view v-if="loading" class="chart-loading">加载中…</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/** 全屏K线页：竖屏/横屏（参考原站横屏全屏）双模式，无 tabBar 专注看图 */
import { ref, onMounted } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import KLineChart from '../../components/KLineChart.vue';
import { fetchKline, fetchReal, PERIOD_LABELS, PERIOD_ORDER, toSymbol } from '../../api/cnfin';
import type { KLine, Period, RealQuote } from '../../api/cnfin';
import { computeChan } from '../../chan/index';
import type { ChanDraw } from '../../chan/types';
import { getPrefs } from '../../utils/storage';
import { getCurrencyInfo } from '../../utils/currency';
import { computed } from 'vue';

const periods = PERIOD_ORDER;
const periodLabels = PERIOD_LABELS;
const prefs = getPrefs();

const code = ref('sh000001');
const name = ref('');
const period = ref<Period>('day');
const klines = ref<KLine[]>([]);
const real = ref<RealQuote | null>(null);
const draw = ref<ChanDraw | null>(null);
const loading = ref(false);
const isLandscape = ref(true);

const cur = computed(() => getCurrencyInfo(toSymbol(code.value)));

/* ---------------- 量化演示叠加（与主页共用存储） ---------------- */
interface QuantDemo {
  name: string;
  marks: { day: string; price: number; dir: 'B' | 'S' }[];
  stats: { trades: number; wins: number; winRate: number; pnlPct: number };
}
const quantDemo = ref<QuantDemo | null>(null);
const quantVisible = ref(true);
const loadQuantDemo = () => {
  try { quantDemo.value = uni.getStorageSync('CL_QUANT_DEMO') || null; } catch { quantDemo.value = null; }
};
const QUANT_THEORY: Record<string, string> = {
  ma_cross: '双均线交叉（趋势跟踪）：MA5 上穿 MA20 金叉买入，下穿死叉卖出。震荡市会反复止损。',
  boll: '布林带回归（均值回归）：跌破下轨超跌买入，回到中轨卖出。单边下跌需硬止损。',
  rsi: 'RSI 动量修复：RSI(14) 从 30 下方回升穿 30 买入，从 70 上方回落穿 70 卖出。强趋势中会钝化。',
  turtle: '海龟突破（唐奇安通道）：收盘价突破前 20 日最高价买入，跌破前 10 日最低价离场。注意假突破。',
};
const onQuantSig = (sig: { day: string; price: number; dir: 'B' | 'S' } | null) => {
  if (!sig) return;
  const key = (quantDemo.value as any)?.key as string | undefined;
  const theory = (key && QUANT_THEORY[key]) || '策略信号说明见「量化」Tab。';
  uni.showModal({
    title: `量化${sig.dir === 'B' ? '买入' : '卖出'}信号${quantDemo.value ? ' · ' + quantDemo.value.name : ''}`,
    content: `${sig.day}  @ ${Math.round(sig.price * 100) / 100}\n${theory}\n回测仅供学习，不构成投资建议。`,
    showCancel: false,
    confirmText: '知道了',
  });
};

const load = async () => {
  loading.value = true;
  try {
    const [kl, rq] = await Promise.all([
      fetchKline(code.value, period.value, 1440, prefs.fq),
      fetchReal(code.value).catch(() => null),
    ]);
    klines.value = kl;
    if (rq) real.value = rq;
    draw.value = computeChan(kl, { gap: prefs.biMode === 'strict' ? 4 : 3, gapMerge: prefs.gapMerge, zsRange: prefs.zsRange, zsStd: prefs.zsStd, segAlgo: prefs.segAlgo, showMarkers: prefs.showMarkers });
    if (rq) name.value = rq.name;
  } catch (e: any) {
    uni.showToast({ title: '加载失败：' + (e?.message || e), icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const switchPeriod = (p: Period) => {
  if (period.value === p) return;
  period.value = p;
  load();
};
/** 离开横屏页时解除方向锁定与全屏，让主页恢复默认竖屏 */
const restorePortrait = async () => {
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch { /* 浏览器不支持时忽略 */ }
};
const goBack = async () => {
  await restorePortrait();
  isLandscape.value = false;
  uni.navigateBack();
};
onUnload(() => {
  uni.$off('cl-quant', onQuantSig);
  restorePortrait();
});
const toggleMode = async () => {
  try {
    if (!isLandscape.value) {
      // 进入横屏：请求全屏 + 锁定横屏
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
      isLandscape.value = true;
    } else {
      // 切回竖屏
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      isLandscape.value = false;
    }
  } catch {
    // 浏览器不支持 orientation lock 时仅切换状态
    isLandscape.value = !isLandscape.value;
  }
};

onLoad((opts: any) => {
  if (opts?.code) code.value = opts.code;
  if (opts?.name) name.value = decodeURIComponent(opts.name);
  if (opts?.period && periods.includes(opts.period)) period.value = opts.period;
  loadQuantDemo();
  uni.$on('cl-quant', onQuantSig);
  if (opts?.mode !== 'v') {
    // 默认横屏：请求全屏 + 锁定方向
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      }).catch(() => {});
    }
    isLandscape.value = true;
  } else {
    // 以竖屏模式进入时不请求横屏
    isLandscape.value = false;
  }
  load();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  /* 不再锁死一屏：横屏视口很矮时允许页面滚动，避免图表被裁掉一半 */
  min-height: 100vh;
  min-height: 100dvh;
  background: #ffffff;
  padding-top: env(safe-area-inset-top);
}
/* 横屏模式由 Fullscreen API + orientation lock 控制 */
.quant-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 6rpx 20rpx;
  padding: 8rpx 16rpx;
  background: rgba(142, 68, 173, 0.08);
  border: 1rpx solid rgba(142, 68, 173, 0.35);
  border-radius: 8rpx;
}
.quant-text {
  flex: 1;
  font-size: 22rpx;
  color: #8e44ad;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.quant-op { font-size: 22rpx; color: #1890ff; }
.quote-head {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  padding: 10rpx 20rpx;
  position: relative;
}
.mode-toggle {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 22rpx;
  color: #1890ff;
  border: 1px solid #1890ff;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}
.quote-name { font-size: 28rpx; color: #333333; font-weight: 500; }
.quote-price { font-size: 36rpx; font-weight: 600; }
.quote-currency { font-size: 22rpx; color: #6c757d; }
.quote-sub { font-size: 22rpx; }
.up { color: #e74c3c; }
.down { color: #0a8f4e; }
.period-row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}
.period-item {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #666666;
  padding: 12rpx 0 8rpx;
  border-bottom: 4rpx solid transparent;
}
.period-item.active {
  color: #e74c3c;
  font-weight: 600;
  border-bottom-color: #e74c3c;
}
.period-item.exit { color: #999999; }
.chart-area { flex: 1 0 auto; position: relative; min-height: 300px; }
.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999999;
  font-size: 24rpx;
}
</style>
