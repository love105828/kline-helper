<template>
  <view class="page" :class="{ landscape: isLandscape }">
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
      />
      <view v-if="loading" class="chart-loading">加载中…</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/** 全屏K线页：竖屏/横屏（参考原站横屏全屏）双模式，无 tabBar 专注看图 */
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
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
const goBack = () => uni.navigateBack();
const toggleMode = () => { isLandscape.value = !isLandscape.value; };

onLoad((opts: any) => {
  if (opts?.code) code.value = opts.code;
  if (opts?.name) name.value = decodeURIComponent(opts.name);
  if (opts?.period && periods.includes(opts.period)) period.value = opts.period;
  isLandscape.value = opts?.mode !== 'v'; // ⛶ 默认进入横屏模式
  load();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
}
/* 横屏模式：容器旋转 90° 铺满竖屏视口（参考原站横屏全屏K线） */
.page.landscape {
  position: fixed;
  top: 0;
  left: 100vw;
  width: 100vh;
  height: 100vw;
  transform: rotate(90deg);
  transform-origin: left top;
  padding-top: 0;
}
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
.chart-area { flex: 1; position: relative; min-height: 0; }
.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999999;
  font-size: 24rpx;
}
</style>
