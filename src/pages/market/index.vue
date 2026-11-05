<template>
  <view class="page-container">
    <!-- 公告条（米黄圆角，对照原站 notice-bar） -->
    <view v-if="!prefs.noticeClosed" class="notice-bar">
      <text class="notice-icon">📢</text>
      <text class="notice-text">K线看图助手 · 支持沪深/科创/创业/港股/美股 · 仅供学习研究</text>
      <text class="notice-close" @click="closeNotice">×</text>
    </view>

    <!-- 搜索条（白色，灰底圆角输入框 + 红色刷新按钮） -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          v-model="query"
          class="search-input"
          placeholder="输入标的"
          placeholder-class="search-ph"
          confirm-type="search"
          @input="onQuery"
          @confirm="onConfirm"
          @focus="onQuery"
          @blur="onBlur"
        />
      </view>
      <view class="search-btn" @click="reload">
        <text class="search-btn-text">刷新</text>
      </view>
    </view>

    <!-- 搜索联想面板 -->
    <view v-if="suggestions.length && showSug" class="suggest-panel">
      <view v-for="s in suggestions" :key="s.code" class="suggest-item" @click="selectSymbol(s)">
        <view class="suggest-item-left">
          <text class="suggest-tag" :class="'tag-' + s.market">{{ s.tag }}</text>
          <text class="suggest-item-name">{{ s.name }}</text>
        </view>
        <text class="suggest-item-code">{{ s.code }}</text>
      </view>
    </view>

    <!-- 图表白色大卡片 -->
    <view class="chart-section">
      <!-- 卡片头：AI分析 + 控制按钮 -->
      <view class="chart-header">
        <view class="header-left-btns">
          <view class="ai-btn" @click="goAiPage">
            <text class="ai-btn-text">AI助手</text>
          </view>
        </view>
        <view class="control-buttons">
          <view class="ctrl-btn" @click="chartPan(-1)">◀</view>
          <view class="ctrl-btn" @click="chartZoom(1)">＋</view>
          <view class="ctrl-btn" @click="chartZoom(-1)">－</view>
          <view class="ctrl-btn" @click="chartPan(1)">▶</view>
          <view class="ctrl-btn ctrl-btn-red" @click="goFullscreen">⛶</view>
        </view>
      </view>

      <!-- K线容器 -->
      <view class="kline-container">
        <!-- 报价头（灰条） -->
        <view class="kline-header">
          <view class="stock-info">
            <text class="stock-name">{{ stockName }}</text>
            <text class="stock-code">{{ stockCodeLabel }}</text>
            <text class="stock-price" :class="real && real.change >= 0 ? 'c-up' : 'c-down'">{{ real ? real.last : '--' }}</text>
            <text class="stock-currency">{{ cur.suffix }}</text>
            <text class="stock-change" :class="real && real.change >= 0 ? 'c-up' : 'c-down'">
              {{ real ? `${real.change >= 0 ? '+' : ''}${real.change} (${real.changeRate >= 0 ? '+' : ''}${real.changeRate}%)` : '' }}
            </text>
            <text class="stock-ext">今开 {{ real ? real.open : '--' }} · 最高 {{ real ? real.high : '--' }} · 最低 {{ real ? real.low : '--' }} · 昨收 {{ real ? real.preclose : '--' }}（{{ cur.suffix }}）</text>
          </view>
        </view>

    <!-- 量化演示条 -->
    <view v-if="quantDemo" class="quant-bar" :class="{ 'quant-hidden': !quantVisible }">
      <text class="quant-text" @click="openQuantTutorial">🎯 {{ quantDemo.name }}（{{ quantVisible ? '演示中' : '已隐藏' }}）· 交易 {{ quantDemo.stats.trades }} 次 · 胜率 {{ quantDemo.stats.winRate }}% · 累计 {{ quantDemo.stats.pnlPct > 0 ? '+' : '' }}{{ quantDemo.stats.pnlPct }}%</text>
      <text class="quant-clear" @click="openQuantTutorial">教程</text>
      <text class="quant-clear" @click="quantVisible = !quantVisible">{{ quantVisible ? '隐藏' : '显示' }}</text>
      <text class="quant-clear" @click="clearQuant">清除</text>
    </view>

        <!-- 周期块（灰条，蓝色激活块） -->
        <view class="period-tabs">
          <view
            v-for="p in periods"
            :key="p"
            class="period-tab"
            :class="{ active: period === p }"
            @click="switchPeriod(p)"
          >
            <text class="period-text">{{ periodLabels[p] }}</text>
          </view>
        </view>

        <!-- 缠论开关行 -->
        <view class="ma-favorite-row">
          <view class="ma-buttons">
            <view class="ma-btn" :class="{ active: prefs.showStroke }" @click="toggle('showStroke')">
              <text class="ma-btn-text">笔</text>
              <text class="ma-info" @click.stop="showExplain('showStroke')">?</text>
            </view>
            <view class="ma-btn" :class="{ active: prefs.showPivot }" @click="toggle('showPivot')">
              <text class="ma-btn-text">中枢</text>
              <text class="ma-info" @click.stop="showExplain('showPivot')">?</text>
            </view>
            <view class="ma-btn" :class="{ active: prefs.showSegment }" @click="toggle('showSegment')">
              <text class="ma-btn-text">线段</text>
              <text class="ma-info" @click.stop="showExplain('showSegment')">?</text>
            </view>
            <view class="ma-btn" :class="{ active: prefs.showTrend }" @click="toggle('showTrend')">
              <text class="ma-btn-text">走势</text>
              <text class="ma-info" @click.stop="showExplain('showTrend')">?</text>
            </view>
            <view class="ma-btn" :class="{ active: prefs.showVol }" @click="toggle('showVol')">
              <text class="ma-btn-text">VOL</text>
              <text class="ma-info" @click.stop="showExplain('showVol')">?</text>
            </view>
            <view class="ma-btn" :class="{ active: prefs.showMarkers }" @click="toggle('showMarkers')">
              <text class="ma-btn-text">买卖</text>
              <text class="ma-info" @click.stop="showExplain('showMarkers')">?</text>
            </view>
          </view>
          <view class="right-btn-group">
            <view class="settings-btn" @click="settingsOpen = true">
              <text class="settings-btn-text">设置</text>
            </view>
            <view class="favorite-btn" @click="toggleFav">
              <text class="favorite-btn-text">{{ isFav ? '已收藏' : '+收藏' }}</text>
            </view>
          </view>
        </view>

        <!-- 图表 -->
        <view class="chart-wrapper">
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
            :show-markers="prefs.showMarkers"
            :show-cursor="prefs.showCursor"
            :currency-suffix="cur.suffix"
            :currency-axis="cur.axis"
            :tdx-lines="tdxLines ?? undefined"
            :quant-marks="quantDemo && quantVisible ? quantDemo.marks : undefined"
          />
          <view v-if="loading" class="chart-loading">加载中…</view>
        </view>
      </view>
    </view>

    <!-- 底部免责（固定在 tabbar 上方，对照原站 bottom-tip） -->
    <view class="bottom-tip">
      <text class="bottom-tip-text">免责声明：仅供学习研究，不构成任何投资建议。</text>
    </view>

    <!-- 底部留白（bottom-tip 为 fixed） -->
    <view class="bottom-space" />

    <!-- 量化演示详细教程弹窗 -->
    <view v-if="quantTutorial" class="mask" @click="quantTutorial = false">
      <view class="explain-sheet" @click.stop style="max-width: 380px; width: 90%">
        <view class="ex-title">量化演示 · 详细教程</view>
        <scroll-view scroll-y style="max-height: 60vh">
          <view class="blk" v-for="(step, j) in quantTutorial" :key="j">
            <text class="blk-label step">{{ step.title }}</text>
            <text class="blk-text" style="white-space: pre-line">{{ step.body }}</text>
          </view>
        </scroll-view>
        <view class="ex-close" @click="quantTutorial = false">开始看图</view>
      </view>
    </view>

    <!-- 功能开关说明弹窗 -->
    <view v-if="explain" class="mask" @click="explain = null">
      <view class="explain-sheet" @click.stop>
        <view class="ex-title">{{ explain.title }}</view>
        <text class="ex-text">{{ explain.text }}</text>
        <view v-for="(pt, j) in explain.points" :key="j" class="ex-pt">
          <text class="ex-dot">•</text>
          <text class="ex-pt-text">{{ pt }}</text>
        </view>
        <view class="ex-close" @click="explain = null">知道了</view>
      </view>
    </view>

    <!-- 量化信号详情弹窗（点击图上菱形触发） -->
    <view v-if="quantDetail" class="mask" @click="quantDetail = null">
      <view class="sheet" @click.stop>
        <view class="mk-head">
          <text class="mk-badge" :class="quantDetail.isBuy ? 'mk-b' : 'mk-s'">{{ quantDetail.dir === 'B' ? '买' : '卖' }}</text>
          <view class="mk-head-main">
            <text class="mk-title">量化{{ quantDetail.dir === 'B' ? '买入' : '卖出' }}信号 · {{ quantDetail.name }}</text>
            <text class="mk-date">{{ quantDetail.day }}</text>
          </view>
          <text class="mk-close" @click="quantDetail = null">×</text>
        </view>
        <scroll-view scroll-y class="mk-body">
          <view class="blk">
            <text class="blk-label def">理论依据（{{ quantDetail.system }}）</text>
            <text class="blk-text">{{ quantDetail.theory }}</text>
          </view>
          <view class="blk">
            <text class="blk-label step">信号与配对结果（回测数据）</text>
            <view v-for="(row, j) in quantDetail.rows" :key="j" class="data-row">
              <text class="data-k">{{ row[0] }}</text>
              <text class="data-v" :class="{ hl: row[2] }">{{ row[1] }}</text>
            </view>
          </view>
          <view class="blk">
            <text class="blk-label risk">风险与局限</text>
            <text class="blk-text">{{ quantDetail.risk }}</text>
          </view>
          <view class="tip">
            <text class="tip-text">回测为逐对全仓简化统计（无手续费滑点），仅供学习研究，不构成投资建议。</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 买卖点成因详情弹窗（点击图上标记触发） -->
    <view v-if="markerDetail" class="mask" @click="markerDetail = null">
      <view class="sheet" @click.stop>
        <view class="mk-head">
          <text class="mk-badge" :class="markerDetail.isBuy ? 'mk-b' : 'mk-s'">{{ markerDetail.label }}</text>
          <view class="mk-head-main">
            <text class="mk-title">{{ markerDetail.name }}</text>
            <text class="mk-date">{{ markerDetail.day }}</text>
          </view>
          <text class="mk-close" @click="markerDetail = null">×</text>
        </view>
        <scroll-view scroll-y class="mk-body">
          <view class="blk">
            <text class="blk-label def">理论依据</text>
            <text class="blk-text">{{ markerDetail.theory }}</text>
          </view>
          <view class="blk">
            <text class="blk-label step">实际数据（本图自动计算）</text>
            <view v-for="(row, j) in markerDetail.rows" :key="j" class="data-row">
              <text class="data-k">{{ row[0] }}</text>
              <text class="data-v" :class="{ hl: row[2] }">{{ row[1] }}</text>
            </view>
          </view>
          <view class="blk">
            <text class="blk-label risk">失效与止损</text>
            <text class="blk-text">{{ markerDetail.risk }}</text>
          </view>
          <view class="tip">
            <text class="tip-text">信号由算法按上述条件自动标注，仅供学习研究，不构成投资建议。</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 缠论设置弹层（对照原站"缠论设置"面板） -->
    <view v-if="settingsOpen" class="mask" @click="settingsOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-title">缠论设置</view>
        <scroll-view scroll-y class="sheet-body">

          <view class="set-group">缠论-笔规则设置</view>
          <view class="set-row">
            <text class="set-label">笔模式</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.biMode === 'loose' }" @click="setChan('biMode', 'loose')">宽笔</view>
              <view class="seg-item" :class="{ on: prefs.biMode === 'strict' }" @click="setChan('biMode', 'strict')">严笔</view>
            </view>
          </view>
          <view class="set-tip">严笔 = 底分型 + 上涨或下跌K线 + 顶分型 宽笔 = 底分型 + 独立K线 + 顶分型</view>
          <view class="set-row">
            <text class="set-label">缺口处理</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: !prefs.gapMerge }" @click="setChan('gapMerge', false)">不处理</view>
              <view class="seg-item" :class="{ on: prefs.gapMerge }" @click="setChan('gapMerge', true)">视为1根K线</view>
            </view>
          </view>

          <view class="set-group">缠论走势规则设置</view>
          <view class="set-row">
            <text class="set-label">段算法 <text class="set-sub">新手勿改</text></text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.segAlgo === 'simple' }" @click="setChan('segAlgo', 'simple')">简化</view>
              <view class="seg-item" :class="{ on: prefs.segAlgo === 'fs_strict' }" @click="setChan('segAlgo', 'fs_strict')">标准严格</view>
              <view class="seg-item" :class="{ on: prefs.segAlgo === 'fs_optimize' }" @click="setChan('segAlgo', 'fs_optimize')">标准优化</view>
            </view>
          </view>
          <view class="set-tip">共有三种段算法可随时切换：①简化特征序列——笔破坏翻转式，段较多；②标准特征序列·严格包含——特征序列第三元素进行前包含后，段终点非最高最低点；③标准特征序列·优化包含——第三元素不进行前包含后，段终点为最高最低点。不同流派对段划分差异最大处即在此。</view>

          <view class="set-group">缠论-中枢规则设置</view>
          <view class="set-row">
            <text class="set-label">中枢区间 - 重合区域</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.zsRange === 'all' }" @click="setChan('zsRange', 'all')">所有段</view>
              <view class="seg-item" :class="{ on: prefs.zsRange === 'first3' }" @click="setChan('zsRange', 'first3')">前三段</view>
            </view>
          </view>
          <view class="set-row">
            <text class="set-label">中枢区间 - 段标准化</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.zsStd === 'endpoint' }" @click="setChan('zsStd', 'endpoint')">起终点</view>
              <view class="seg-item" :class="{ on: prefs.zsStd === 'actual' }" @click="setChan('zsStd', 'actual')">实际高低点</view>
            </view>
          </view>
          <view class="set-tip">橙色为笔中枢，蓝色为段中枢</view>

          <view class="set-group">复权设置</view>
          <view class="set-row">
            <text class="set-label">复权方式<text v-if="period.startsWith('min')" class="set-sub"> 分钟线不支持</text></text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.fq === 0 }" @click="setFq(0)">不复权</view>
              <view class="seg-item" :class="{ on: prefs.fq === 1 }" @click="setFq(1)">前复权</view>
              <view class="seg-item" :class="{ on: prefs.fq === 2 }" @click="setFq(2)">后复权</view>
            </view>
          </view>
          <view class="set-tip">除权除息会改变真实价格：看长周期结构与中枢建议不复权；美股强制前复权（拆股必需）。</view>

          <view class="set-group">缠论-图表默认设置</view>
          <view class="set-row">
            <text class="set-label">光标</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: !prefs.showCursor }" @click="toggleCursor(false)">隐藏</view>
              <view class="seg-item" :class="{ on: prefs.showCursor }" @click="toggleCursor(true)">显示</view>
            </view>
          </view>
          <view class="set-row">
            <text class="set-label">MA均线 / MACD</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: prefs.showMa }" @click="toggle('showMa')">MA</view>
              <view class="seg-item" :class="{ on: prefs.showMacd }" @click="toggle('showMacd')">MACD</view>
            </view>
          </view>
          <view class="set-tip">MA：主图叠加 5/10/20/60 均线，趋势氛围参考。MACD：副图 DIF/DEA 双线与红绿柱，背驰判定的核心辅助——鼠标悬停K线时信息栏同步显示 DIF/DEA/MACD 数值，一买/一卖的柱面积对比也在详情中展示。</view>
          <view class="set-row">
            <text class="set-label">TDX 公式</text>
            <view class="seg">
              <view class="seg-item" :class="{ on: !!prefs.tdxFormula }" @click="tdxOpen = true">{{ prefs.tdxFormula ? '已导入' : '导入' }}</view>
              <view v-if="prefs.tdxFormula" class="seg-item" @click="clearTdx">清除</view>
            </view>
          </view>
          <view class="set-tip">粘贴 TDX 指标公式（如 MA5:MA(CLOSE,5);），输出线叠加在主图上。支持 MA/EMA/SMA/REF/HHV/LLV/CROSS/COUNT/IF 等常用函数；NAME:表达式; 输出，NAME:=表达式; 中间变量，DRAW* 语句自动忽略。</view>
          <view class="set-tip">打开光标K线图中可显示十字光标：O=开盘价 C=收盘价 L=最低价 H=最高价</view>

          <view class="sheet-reset" @click="resetChan">恢复默认设置</view>
        </scroll-view>
        <view class="sheet-close" @click="settingsOpen = false">完成</view>
      </view>
    </view>

    <!-- 通达信公式导入弹窗 -->
    <view v-if="tdxOpen" class="mask" @click="tdxOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-title">TDX 公式导入</view>
        <textarea
          v-model="tdxText"
          class="tdx-textarea"
          :maxlength="-1"
          placeholder="MA5:MA(CLOSE,5);&#10;MA10:MA(CLOSE,10);&#10;DIF:=EMA(CLOSE,12)-EMA(CLOSE,26);&#10;DEA:=EMA(DIF,9);&#10;MACD:(DIF-DEA)*2;"
        />
        <view v-if="tdxError" class="tdx-error">{{ tdxError }}</view>
        <view class="sheet-close" @click="importTdx">导入并叠加</view>
        <view class="sheet-cancel" @click="tdxOpen = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import KLineChart from '../../components/KLineChart.vue';
import { fetchKline, fetchReal, PERIOD_LABELS, PERIOD_ORDER, toSymbol } from '../../api/cnfin';
import type { KLine, Period, RealQuote } from '../../api/cnfin';
import { computeChan } from '../../chan/index';
import type { ChanDraw } from '../../chan/types';
import { searchStocks } from '../../utils/stockList';
import type { StockItem } from '../../utils/stockList';
import { suggestAll as suggestTencent } from '../../api/tencent';
import { getCurrencyInfo } from '../../utils/currency';
import { setChanCache } from '../../ai/cache';
import { runTdxFormula } from '../../tdx/interpreter';
import { chatStream } from '../../ai/client';
import {
  getAiProviders, saveAiProviders, getActiveAiProvider, setActiveAiProvider, getAiHistory, pushAiHistory,
} from '../../utils/storage';
import type { AiProvider, AiHistoryItem } from '../../utils/storage';
import type { TdxLine } from '../../tdx/interpreter';
import {
  getPrefs, setPrefs, isFavorite, addFavorite, removeFavorite, consumePendingSymbol, DEFAULT_PREFS,
} from '../../utils/storage';

const periods = PERIOD_ORDER;
const periodLabels = PERIOD_LABELS;

const chartZoom = (dir: number) => uni.$emit('cl-zoom', dir);
const chartPan = (dir: number) => uni.$emit('cl-pan', dir);

const prefs = ref(getPrefs());
const query = ref('');
const suggestions = ref<StockItem[]>([]);
const showSug = ref(false);
const period = ref<Period>(prefs.value.period);
const symbol = ref(prefs.value.symbol);
const name = ref(prefs.value.name);
const klines = ref<KLine[]>([]);
const real = ref<RealQuote | null>(null);
const draw = ref<ChanDraw | null>(null);
const loading = ref(false);
const settingsOpen = ref(false);
const isFav = ref(false);

const stockName = computed(() => real.value?.name || name.value || symbol.value);
const stockCodeLabel = computed(() => {
  const s = toSymbol(symbol.value);
  if (s.startsWith('hk')) return 'HK' + s.slice(2);
  if (s.startsWith('us')) return s.slice(2).toUpperCase();
  return s.slice(0, 2).toUpperCase() + s.slice(2);
});

/** 货币单位（按市场：元/港元/美元/点） */
const cur = computed(() => getCurrencyInfo(toSymbol(symbol.value)));

/* ---------------- 通达信公式叠加 ---------------- */
const tdxOpen = ref(false);
const tdxText = ref('');
const tdxError = ref('');
const tdxLines = ref<TdxLine[] | null>(null);

const importTdx = () => {
  const src = tdxText.value.trim();
  if (!src) { tdxError.value = '请输入公式'; return; }
  const r = runTdxFormula(src, {
    open: klines.value.map((k) => k.open),
    high: klines.value.map((k) => k.high),
    low: klines.value.map((k) => k.low),
    close: klines.value.map((k) => k.close),
    volume: klines.value.map((k) => k.volume),
  });
  if (r.error) { tdxError.value = '公式错误：' + r.error; return; }
  tdxLines.value = r.lines;
  setPrefs({ tdxFormula: src });
  prefs.value.tdxFormula = src;
  tdxError.value = '';
  tdxOpen.value = false;
};
const clearTdx = () => {
  tdxLines.value = null;
  tdxText.value = '';
  setPrefs({ tdxFormula: '' });
  prefs.value.tdxFormula = '';
};
const initTdxFromPrefs = () => {
  const src = prefs.value.tdxFormula;
  if (!src) { tdxLines.value = null; return; }
  tdxText.value = src;
  const r = runTdxFormula(src, {
    open: klines.value.map((k) => k.open),
    high: klines.value.map((k) => k.high),
    low: klines.value.map((k) => k.low),
    close: klines.value.map((k) => k.close),
    volume: klines.value.map((k) => k.volume),
  });
  tdxLines.value = r.error ? null : r.lines;
};

const load = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const sym = toSymbol(symbol.value);
    const [kl, rq] = await Promise.all([
      fetchKline(sym, period.value, 1440, prefs.value.fq),
      fetchReal(sym).catch(() => null),
    ]);
    klines.value = kl;
    if (rq) real.value = rq;
    else if (kl.length) {
      const last = kl[kl.length - 1];
      const prev = kl[kl.length - 2] ?? last;
      const chg = Math.round((last.close - prev.close) * 100) / 100;
      real.value = {
        name: name.value, last: last.close, change: chg,
        changeRate: prev.close ? Math.round((chg / prev.close) * 10000) / 100 : 0,
        open: last.open, high: last.high, low: last.low, preclose: prev.close,
      };
    }
    draw.value = computeChan(kl, chanConfig());
    setChanCache(sym, period.value, prefs.value.fq, kl, draw.value);
    initTdxFromPrefs();
    setPrefs({ symbol: sym, name: name.value, period: period.value });
    isFav.value = isFavorite(sym);
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

const reload = () => {
  const q = query.value.trim();
  if (q) {
    const hit = searchStocks(q, 1)[0];
    if (hit) { selectSymbol(hit); return; }
    // 纯代码（数字/字母/市场前缀）直接解析，避免股票名污染 symbol
    if (/^(\d{1,6}|[a-z]{1,6}(\.[a-z]{1,2})?|(sh|sz|bj|hk|us)[0-9a-z.]+)$/i.test(q)) {
      const sym = toSymbol(q);
      if (sym !== symbol.value) {
        symbol.value = sym;
        name.value = sym;
      }
      load();
      return;
    }
    // 文本关键词：远程联想解析后再加载，失败则刷新当前
    suggestTencent(q, 1)
      .then((items) => {
        if (items.length) selectSymbol(items[0] as any);
        else load();
      })
      .catch(() => load());
    return;
  }
  load();
};

let sugTimer: ReturnType<typeof setTimeout> | null = null;
let sugSeq = 0;

const onQuery = () => {
  const key = query.value.trim();
  if (!key) {
    suggestions.value = [];
    showSug.value = false;
    return;
  }
  const local = searchStocks(key, 6);
  suggestions.value = local;
  showSug.value = true;
  if (sugTimer) clearTimeout(sugTimer);
  sugTimer = setTimeout(async () => {
    const seq = ++sugSeq;
    try {
      const remote = await suggestTencent(key, 10);
      if (seq !== sugSeq) return;
      const seen = new Set(local.map((s) => s.code));
      suggestions.value = [...local, ...remote.filter((s: any) => !seen.has(s.code))].slice(0, 12);
    } catch { /* 联想失败保留本地结果 */ }
  }, 300);
};
const onBlur = () => { setTimeout(() => (showSug.value = false), 150); };
const onConfirm = () => { showSug.value = false; reload(); };

const selectSymbol = (s: StockItem) => {
  showSug.value = false;
  query.value = s.name;
  symbol.value = s.code;
  name.value = s.name;
  load();
};

const toggle = (key: 'showStroke' | 'showSegment' | 'showPivot' | 'showTrend' | 'showVol' | 'showMacd' | 'showMa' | 'showMarkers' | 'showCursor') => {
  prefs.value[key] = !prefs.value[key];
  setPrefs({ [key]: prefs.value[key] } as any);
};
const toggleCursor = (v: boolean) => {
  prefs.value.showCursor = v;
  setPrefs({ showCursor: v });
};
/** 复权方式变更：K线数据本身改变，清空后重拉（保证切换肉眼可见） */
const setFq = (v: 0 | 1 | 2) => {
  prefs.value.fq = v;
  setPrefs({ fq: v });
  klines.value = [];
  draw.value = null;
  uni.showToast({ title: v === 0 ? '已切换：不复权，重新加载中' : v === 1 ? '已切换：前复权，重新加载中' : '已切换：后复权，重新加载中', icon: 'none', duration: 1200 });
  load();
};

/* ---------------- 买卖点成因详情 ---------------- */
interface MarkerDetail {
  label: string; name: string; day: string; isBuy: boolean;
  theory: string; rows: [string, string, boolean?][]; risk: string;
}
const markerDetail = ref<MarkerDetail | null>(null);

const num = (v: any) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : v);
const pct = (a: number, b: number) => (a ? `（${a > b ? '缩小' : '放大'} ${Math.round(Math.abs(1 - b / a) * 100)}%）` : '');

function buildDetail(mk: any): MarkerDetail {
  const r = mk.reason || {};
  const isBuy = mk.type.startsWith('B');
  if (mk.type === 'B1' || mk.type === 'S1') {
    const buy = mk.type === 'B1';
    return {
      label: mk.label, name: '第一类' + (buy ? '买点' : '卖点') + ' · 趋势背驰', day: mk.day, isBuy,
      theory: buy
        ? '下跌趋势中，本段下跌创出新低，但 MACD 绿柱面积明显小于前一段同向下跌——空方动能衰竭，趋势随时可能反转。这是最左侧的抄底信号。'
        : '上涨趋势中，本段上涨创出新高，但 MACD 红柱面积明显小于前一段同向上涨——多方动能衰竭，趋势随时可能反转。这是最左侧的逃顶信号。',
      rows: [
        [buy ? '前段低点' : '前段高点', `${num(r.prevExtreme)}（${String(r.prevDay).slice(5)}）`],
        [buy ? '本段新低' : '本段新高', `${num(r.curExtreme)}（${String(r.curDay).slice(5)}）`, true],
        ['前段 MACD 面积', `${num(r.prevArea)}（${String(r.prevRange?.[0]).slice(5)}~${String(r.prevRange?.[1]).slice(5)}）`],
        ['本段 MACD 面积', `${num(r.curArea)}${pct(num(r.prevArea), num(r.curArea))}`, true],
        ['前段 DIF 峰值', num(r.prevDif)],
        ['本段 DIF 峰值', `${num(r.curDif)}（${buy ? '未随价格创新低' : '未随价格创新高'}）`, true],
        ['本段 K 线数', `${r.bars} 根`],
        ['趋势背景（此前中枢）', Array.isArray(r.pivots) && r.pivots.length ? r.pivots.join(' → ') : '—'],
        ['动能萎缩阈值', '需小于前段的 85%'],
      ],
      risk: buy
        ? `止损：本段低点 ${num(r.curExtreme)}。跌破该点说明背驰判定失败、下跌延续，立即离场；一买后常需二买确认。`
        : `失效：本段高点 ${num(r.curExtreme)} 被突破即背驰失败、上涨延续。强势股一卖后常见二次冲顶。`,
    };
  }
  if (mk.type === 'B2' || mk.type === 'S2') {
    const buy = mk.type === 'B2';
    return {
      label: mk.label, name: '第二类' + (buy ? '买点' : '卖点') + ' · 回调/反弹确认', day: mk.day, isBuy,
      theory: buy
        ? '一买出现后，次级别上涨、随后回调——回调低点不再创新低，说明下跌动能确认衰竭，趋势逆转得到确认。确定性显著高于一买。'
        : '一卖出现后，次级别下跌、随后反弹——反弹高点不再创新高，说明上涨动能确认衰竭，趋势逆转得到确认。',
      rows: [
        [`第一类${buy ? '买' : '卖'}点`, `${num(r.b1Price)}（${String(r.b1Day).slice(5)}）`],
        [buy ? '本次回调低点' : '本次反弹高点', `${num(r.curPrice)}（${String(r.curDay).slice(5)}）`, true],
        [buy ? '未破一买低点' : '未破一卖高点', buy ? `距一买 ${Math.round(Math.abs(num(r.curPrice) - num(r.b1Price)) * 100) / 100}` : `距一卖 ${Math.round(Math.abs(num(r.curPrice) - num(r.b1Price)) * 100) / 100}`, true],
      ],
      risk: buy
        ? `止损：一买低点 ${num(r.b1Price)}（与一买同损，天然小止损）。回调跌破该点则一买失败、二买不成立。`
        : `失效：反弹突破一卖高点 ${num(r.b1Price)} 即失败。`,
    };
  }
  const buy = mk.type === 'B3';
  return {
    label: mk.label, name: '第三类' + (buy ? '买点' : '卖点') + ' · 中枢' + (buy ? '上移' : '下移') + '确认', day: mk.day, isBuy,
    theory: buy
      ? '价格向上突破中枢上沿 ZG 后，次级别回抽的低点不回到中枢区间——中枢整体上移，新的上涨阶段展开。三类买卖点中趋势跟随属性最强。'
      : '价格向下跌破中枢下沿 ZD 后，次级别回抽的高点不回到中枢区间——中枢整体下移，新的下跌阶段展开。',
      rows: [
        [`中枢区间`, `${r.pivot}（${num(r.zd)} ~ ${num(r.zg)}）`],
        [buy ? '中枢上沿 ZG' : '中枢下沿 ZD', num(buy ? r.zg : r.zd), true],
        ['中枢震荡极值 GG/DD', `${num(r.dd)} ~ ${num(r.gg)}`],
        ['中枢构成元素', `${r.n} 段`],
        [buy ? '突破后回抽低点' : '跌破后回抽高点', `${num(r.pullbackPrice)}（${String(r.pullbackDay).slice(5)}）`, true],
        [buy ? '回抽 > ZG ✓' : '回抽 < ZD ✓', '不再回到中枢区间', true],
      ],
    risk: buy
      ? `止损：中枢上沿 ZG ${num(r.zg)}。回抽跌回中枢内则三买失效，可能转为中枢延伸（震荡）；震荡市中该信号会反复失败，先看大级别方向。`
      : `失效：回抽涨回中枢内（高于 ZD ${num(r.zd)}）即失败。同理需先确认大级别方向。`,
  };
}

onMounted(() => {
  uni.$on('cl-marker', (mk: any) => {
    if (mk) markerDetail.value = buildDetail(mk);
  });
  uni.$on('cl-quant', (sig: any) => {
    if (sig) quantDetail.value = buildQuantDetail(sig);
  });
});
onBeforeUnmount(() => {
  uni.$off('cl-marker');
  uni.$off('cl-quant');
});

/* ---------------- 功能开关说明 ---------------- */
const FEATURE_INFO: Record<string, { title: string; text: string; points: string[] }> = {
  showStroke: {
    title: '笔', text: '相邻的顶分型与底分型之间的连线，是缠论中最小的完整波动单元。',
    points: ['笔由分型生长而来，顶底必须交替', '严笔：顶底间至少5根合并K线；宽笔：至少4根（设置中可切换）', '所有更高级别结构（段、中枢）都由笔构成'],
  },
  showPivot: {
    title: '中枢', text: '至少三段连续次级别走势的重叠区间，是多空反复争夺的成本区域，也是所有买卖点的参照物。',
    points: ['矩形框上下边 = ZG/ZD（重叠区间）', '框内文字"N 笔"表示构成中枢的元素数量', '橙色框为笔中枢，橙色描边的大框为段中枢', '三买/三卖正是围绕中枢上下沿定义的'],
  },
  showSegment: {
    title: '线段', text: '至少三笔构成的高级波动单元，用特征序列分型判定终结。',
    points: ['线段比笔更稳定，过滤掉笔级别的小噪音', '段中枢（大框）反映更高级别的成本区', '"最小组件=段"时以特征序列递归；"=笔"时以走势类型递归（设置中可切换）'],
  },
  showTrend: {
    title: '走势', text: '段中枢中点的连线 + 走势类型标注，展示大级别方向。',
    points: ['连线向上且中枢依次抬高 → 上涨趋势', '连线向下且中枢依次降低 → 下跌趋势', '图上自动标注"上涨趋势/下跌趋势/中枢扩展"', '只有一个中枢时为盘整，不产生趋势标注'],
  },
  showVol: {
    title: 'VOL 成交量', text: '底部副图显示每根K线的成交量，颜色随涨跌（涨红跌绿）。',
    points: ['验证突破有效性：放量突破更可靠', '验证回调健康度：缩量回抽是强势形态', '配合三买/三卖使用：离开段放量、回抽缩量'],
  },
  showMa: {
    title: 'MA 均线', text: '主图叠加 5/10/20/60 日简单移动平均线。',
    points: ['MA 不是缠论结构，仅作趋势氛围参考', '均线多头排列（MA5>MA10>MA20）与上涨趋势互相印证'],
  },
  showMacd: {
    title: 'MACD', text: '副图显示 DIF/DEA 双线与红绿柱（12,26,9 国内口径）。',
    points: ['背驰判定的核心辅助：比较两段走势的柱面积', '一买/一卖 = 创新低/高 + 柱面积明显缩小', '柱面积由本工具自动计算并在买卖点详情中展示'],
  },
  showMarkers: {
    title: '买卖点（缠论）', text: '在K线图上自动标注缠论第一/二/三类买卖点（红三角=买，绿三角=卖），点击标记可查看成因。',
    points: ['关闭后图上只保留量化演示信号，避免与「量化」Tab 的策略信号混在一起', '标记的判定规则见「学习」页的六张买卖点详解卡', '信号由算法按当前段算法与中枢参数自动计算'],
  },
};
const explain = ref<{ title: string; text: string; points: string[] } | null>(null);
const showExplain = (key: string) => {
  explain.value = FEATURE_INFO[key] || null;
};

/* ---------------- 量化演示叠加 ---------------- */
interface QuantDemo {
  name: string;
  marks: { day: string; price: number; dir: 'B' | 'S' }[];
  stats: { trades: number; wins: number; winRate: number; pnlPct: number };
}
const quantDemo = ref<QuantDemo | null>(null);
const quantVisible = ref(true);
const loadQuantDemo = () => {
  try {
    const q = uni.getStorageSync('CL_QUANT_DEMO');
    quantDemo.value = q || null;
    // 首次应用：弹窗讲解怎么看（只弹一次）
    if (q && q.seen === false) {
      const buys = (q.marks || []).filter((m: any) => m.dir === 'B').length;
      const sells = (q.marks || []).length - buys;
      uni.showModal({
        title: '量化演示已开启',
        content: `「${q.name}」的买卖信号已叠加在下方K线图上：紫色◆ = 买入（${buys}个），橙色▼ = 卖出（${sells}个）。回测统计见顶部紫色条。关闭缠论买卖点可只看策略信号（点"买卖"开关），点"清除"移除演示。`,
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          const cur = uni.getStorageSync('CL_QUANT_DEMO');
          if (cur) {
            cur.seen = true;
            uni.setStorageSync('CL_QUANT_DEMO', cur);
          }
        },
      });
    }
  } catch {
    quantDemo.value = null;
  }
};
const clearQuant = () => {
  uni.removeStorageSync('CL_QUANT_DEMO');
  quantDemo.value = null;
};

/* AI 助手页跳转 */
const goAiPage = () => {
  uni.navigateTo({ url: '/pages/ai/index' });
};



const QUANT_THEORY: Record<string, { system: string; theory: string; risk: string }> = {
  ma_cross: {
    system: '趋势跟踪',
    theory: '双均线交叉：短期均线（MA5）上穿长期均线（MA20）= 金叉，代表短期动能强于长期动能、趋势启动，故买入；下穿 = 死叉卖出。趋势行情表现好，震荡行情会反复止损。',
    risk: '震荡市中金叉死叉交替出现（俗称"挨鞭子"），连续小亏是常态；需配合止损与大级别方向过滤。',
  },
  boll: {
    system: '均值回归',
    theory: '布林带回归：收盘价跌破下轨（20日均值 − 2倍标准差）= 统计性超跌，均值引力使其回归中轨，故买入；回到中轨即卖出兑现。',
    risk: '单边下跌中价格会沿下轨下行（"接飞刀"），连续抄底亏损；必须设置硬止损，且避开明确下跌趋势。',
  },
  rsi: {
    system: '动量/均值回归',
    theory: 'RSI(14) 从 30 以下回升穿越 30 = 超卖修复买入；从 70 以上回落穿越 70 = 超买回落卖出。动量极端后的修复是最常见的均值回归机会。',
    risk: '强趋势中 RSI 会钝化（超卖更超卖），信号失效频繁；建议只在大级别非趋势方向上使用。',
  },
  turtle: {
    system: '趋势跟踪（海龟）',
    theory: '唐奇安通道突破：收盘价突破前 20 日最高价 = 新趋势启动，买入；收盘价跌破前 10 日最低价 = 离场。海龟交易法则的核心入场规则。',
    risk: '突破有相当比例是假突破；历史上配合 2N 吊灯止损与仓位分批使用。震荡市磨损显著。',
  },
};

interface QuantSignalDetail {
  name: string; day: string; dir: 'B' | 'S'; isBuy: boolean;
  system: string; theory: string; rows: [string, string, boolean?][]; risk: string;
}
const quantDetail = ref<QuantSignalDetail | null>(null);

const buildQuantDetail = (sig: { day: string; price: number; dir: 'B' | 'S' }): QuantSignalDetail | null => {
  const d = quantDemo.value;
  if (!d) return null;
  const th = QUANT_THEORY[d.key] || { system: '量化策略', theory: '策略信号说明见「量化」Tab。', risk: '回测仅供学习。' };
  const marks = d.marks || [];
  const i = marks.findIndex((m) => m.day === sig.day && m.dir === sig.dir);
  const isBuy = sig.dir === 'B';
  const rows: [string, string, boolean?][] = [
    ['信号类型', isBuy ? '买入 ◆' : '卖出 ▼', true],
    ['信号日期', sig.day, true],
    ['信号价格', Math.round(sig.price * 100) / 100],
    ['策略体系', th.system],
  ];
  if (isBuy) {
    // 买入信号 → 找其后第一个卖出信号作为配对离场
    let exit: { day: string; price: number } | null = null;
    for (let j = i + 1; j < marks.length; j++) {
      if (marks[j].dir === 'S') { exit = marks[j]; break; }
    }
    if (exit) {
      const ret = Math.round((exit.price / sig.price - 1) * 1000) / 10;
      rows.push(['配对离场', `${Math.round(exit.price * 100) / 100}（${exit.day.slice(5)}）`, true]);
      rows.push(['本笔交易收益', `${ret > 0 ? '+' : ''}${ret}%`, true]);
    } else {
      rows.push(['状态', '持仓中（尚无卖出信号）']);
    }
  } else {
    // 卖出信号 → 找其前一个买入信号
    let entry: { day: string; price: number } | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (marks[j].dir === 'B') { entry = marks[j]; break; }
    }
    if (entry) {
      const ret = Math.round((sig.price / entry.price - 1) * 1000) / 10;
      rows.push(['对应开仓', `${Math.round(entry.price * 100) / 100}（${entry.day.slice(5)}）`]);
      rows.push(['本笔交易收益', `${ret > 0 ? '+' : ''}${ret}%`, true]);
    }
  }
  rows.push(['全策略统计', `交易 ${d.stats.trades} 次 · 胜率 ${d.stats.winRate}% · 累计 ${d.stats.pnlPct > 0 ? '+' : ''}${d.stats.pnlPct}%`]);
  return {
    name: d.name, day: sig.day, dir: sig.dir, isBuy,
    system: th.system, theory: th.theory, rows, risk: th.risk,
  };
};

/* ---------------- 量化演示详细教程 ---------------- */
const quantTutorial = ref<null | { title: string; body: string }[]>(null);
const openQuantTutorial = () => {
  const d = quantDemo.value;
  const name = d ? d.name : '当前策略';
  const buys = d ? (d.marks || []).filter((m) => m.dir === 'B').length : 0;
  const sells = d ? (d.marks || []).length - buys : 0;
  quantTutorial.value = [
    {
      title: '第1步 · 认标记',
      body: `往下看K线图主区域：图上叠了两组标记。
① 紫色菱形 ◆ = 策略的买入信号（共${buys}个）；橙色倒三角 ▼ = 卖出信号（共${sells}个）。
② 红色小三角 = 缠论自身的买卖点（一买/二买/三买…），与本策略无关。
找不到紫色的？点击开关行"买卖"把红色三角关掉，图上就只剩策略信号了。`,
    },
    {
      title: '第2步 · 看第一个信号',
      body: `从右往左找最近的一个紫色◆：它下面那根K线就是策略发出"买入"的位置。
手指/鼠标移到那根K线上，顶部信息栏会显示当天的开高低收——这就是策略的入场价（回测用的就是这个价格）。`,
    },
    {
      title: `第3步 · 理解「${name}」在什么条件下发信号`,
      body: `双均线：5日线上穿20日线的那根K线=买，下穿=卖（金叉买、死叉卖）。
布林回归：收盘跌破下轨=买，回到中轨=卖。
RSI：从30以下回升=买，从70以上回落=卖。
海龟突破：收盘创20日新高=买，破10日低点=卖。
（当前演示用的是哪套，见顶部紫条里的策略名。）`,
    },
    {
      title: '第4步 · 一个一个数信号（验证回测）',
      body: `从左往右数：每个紫色◆后紧跟一个橙色▼，算一次完整交易。
顶部统计"交易250次"=这样的一对共250对；"胜率36%"=卖出价高于买入价的比例；"累计+1046%"=每对收益率直接相加（简化回测：全仓、无手续费滑点）。`,
    },
    {
      title: '第5步 · 常用操作',
      body: `· 只看策略信号：点开关行"买卖"隐藏红色三角
· 暂时隐藏策略信号：点紫条"隐藏"（再点"显示"恢复）
· 换个策略：去「量化」Tab 重新点"在主页演示"
· 彻底移除：点紫条"清除"
· 缩放平移：滑轮/手势缩放，◀▶小步平移，双击复位`,
    },
    {
      title: '重要提醒',
      body: `回测是"事后完美统计"：无手续费、无滑点、全仓进出，真实结果一定打折。
胜率36%仍累计正收益，靠的是"赚大亏小"——这正是趋势策略的本质。学习目的是理解信号逻辑，不是照着实盘。`,
    },
  ];
};

/** 缠论参数变更：重算并保存（对照原站设置面板） */
const setChan = (key: string, value: any) => {
  (prefs.value as any)[key] = value;
  setPrefs({ [key]: value } as any);
  // 清空 → 300ms 后重绘：切换在视觉上一定发生（空白可见），并给出文字反馈
  draw.value = null;
  uni.showToast({ title: '已重新计算缠论结构', icon: 'none', duration: 800 });
  setTimeout(() => {
    draw.value = computeChan(klines.value, chanConfig());
  }, 300);
};
const resetChan = () => {
  const keep = { symbol: prefs.value.symbol, name: prefs.value.name, period: prefs.value.period, noticeClosed: prefs.value.noticeClosed };
  prefs.value = { ...DEFAULT_PREFS, ...keep };
  setPrefs(prefs.value);
  draw.value = computeChan(klines.value, chanConfig());
};

/** Prefs → 算法配置映射 */
const chanConfig = () => ({
  gap: prefs.value.biMode === 'strict' ? 4 : 3,
  gapMerge: prefs.value.gapMerge,
  zsRange: prefs.value.zsRange,
  zsStd: prefs.value.zsStd,
  segAlgo: prefs.value.segAlgo,
  showMarkers: prefs.value.showMarkers,
});

const closeNotice = () => {
  prefs.value.noticeClosed = true;
  setPrefs({ noticeClosed: true });
};

const toggleFav = () => {
  const sym = toSymbol(symbol.value);
  if (isFav.value) {
    removeFavorite(sym);
    isFav.value = false;
    uni.showToast({ title: '已取消收藏', icon: 'none' });
  } else {
    addFavorite({ code: sym, name: stockName.value });
    isFav.value = true;
    uni.showToast({ title: '已加入收藏', icon: 'none' });
  }
};

const goFullscreen = () => {
  uni.navigateTo({
    url: `/pages/market/fullscreen-kline?code=${toSymbol(symbol.value)}&period=${period.value}&name=${encodeURIComponent(name.value)}&mode=h`,
  });
};

onShow(() => {
  loadQuantDemo();
  const pending = consumePendingSymbol();
  if (pending && pending.code !== symbol.value) {
    symbol.value = pending.code;
    name.value = pending.name;
    query.value = pending.name;
    load();
  }
});

onMounted(load);
</script>

<style scoped>
/* ============ 页面：浅灰底卡片流（对照原站 page-container） ============ */
.page-container {
  min-height: 100vh;
  min-height: 100dvh;
  background-color: #f5f6fa;
  display: flex;
  flex-direction: column;
}
.c-up { color: #e74c3c; }
.c-down { color: #2ead6c; }

/* ============ 公告条 ============ */
.notice-bar {
  flex-direction: row;
  align-items: center;
  background-color: #fff8e1;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 8px 10px 0;
  display: flex;
}
.notice-icon { font-size: 14px; margin-right: 8px; }
.notice-text {
  flex: 1;
  color: #e65100;
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.notice-close { color: #e65100; font-size: 18px; padding: 0 6px; }

/* ============ 搜索条 ============ */
.search-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #fff;
  padding: 12px 15px;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #f0f2f5;
  border-radius: 22px;
  padding: 9px 14px;
}
.search-icon { color: #999; font-size: 13px; margin-right: 8px; }
.search-input { flex: 1; color: #333; font-size: 14px; height: 20px; }
.search-ph { color: #999; }
.search-btn {
  background-color: #e74c3c;
  border-radius: 22px;
  padding: 9px 16px;
  margin-left: 10px;
}
.search-btn:active { background-color: #c0392b; }
.search-btn-text { color: #fff; font-weight: 500; font-size: 14px; }

/* ============ 联想面板 ============ */
.suggest-panel {
  background-color: #fff;
  border-radius: 8px;
  margin: 2px 15px;
  max-height: 320px;
  overflow: hidden;
  border: 1px solid #eee;
  z-index: 100;
  position: relative;
}
.suggest-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f2f3f5;
}
.suggest-item:active { background-color: #f5f6fa; }
.suggest-item-left { display: flex; align-items: center; flex: 1; }
.suggest-item-name { color: #333; font-size: 14px; }
.suggest-item-code { color: #999; font-size: 12px; margin-left: 10px; }
.suggest-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  color: #fff;
  background: #999;
  margin-right: 8px;
  flex-shrink: 0;
}
.tag-sh { background: #e74c3c; }
.tag-sz { background: #1890ff; }
.tag-hk { background: #f90; }
.tag-us { background: #00b578; }

/* ============ 图表卡片 ============ */
.chart-section {
  background-color: #fff;
  flex-direction: column;
  margin-top: 10px;
  padding: 12px;
  display: flex;
  flex-shrink: 0;
}

/* 卡片头：AI分析 + 控制按钮 */
.chart-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  margin-bottom: 4px;
}
.header-left-btns { display: flex; flex-direction: row; align-items: center; }
.ai-btn {
  background-color: #f90;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 8px 16px;
}
.ai-btn:active { background-color: #e48a02; }
.ai-btn-text { color: #fff; font-weight: 500; font-size: 14px; }
.control-buttons { display: flex; flex-direction: row; align-items: center; }
.ctrl-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-left: 4px;
  font-size: 13px;
  color: #495057;
  font-weight: 600;
}
.ctrl-btn:active { background-color: #e9ecef; }
.ctrl-btn.on { background-color: #1890ff; border-color: #1890ff; color: #fff; }
.ctrl-btn-red { background-color: #ed3f14; border-color: #ed3f14; color: #fff; }

/* 报价头 */
.kline-header {
  background-color: #f8f9fa;
  padding: 8px 10px;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 4px;
}
.stock-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
}
.stock-name { color: #212529; font-weight: 700; font-size: 16px; margin-right: 8px; }
.stock-code {
  color: #6c757d;
  background-color: #e9ecef;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 10px;
}
.stock-price { font-weight: 700; font-size: 16px; margin-right: 2px; }
.stock-currency { color: #6c757d; font-size: 12px; margin-right: 8px; }
.stock-change { font-size: 12px; margin-right: 8px; }
.stock-ext { color: #999; font-size: 11px; width: 100%; margin-top: 4px; }

/* 周期块 */
.period-tabs {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 8px 4px;
}
.period-tab {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border: 1px solid #dee2e6;
  padding: 5px 8px;
  margin-right: 5px;
  border-radius: 4px;
  flex-shrink: 0;
}
.period-tab.active { background-color: #1890ff; border-color: #1890ff; }
.period-text { color: #495057; font-weight: 500; font-size: 12px; }
.period-tab.active .period-text { color: #fff; }

/* 缠论开关行 */
.ma-favorite-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: #fff;
  padding: 6px;
}
.ma-buttons { display: flex; flex-direction: row; align-items: center; flex: 1; flex-wrap: wrap; }
.ma-btn {
  background-color: #e9ecef;
  border: 1px solid #dee2e6;
  padding: 6px 8px 6px 14px;
  margin-right: 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.ma-btn.active { background-color: #1890ff; border-color: #1890ff; }
.ma-btn-text { color: #495057; font-weight: 500; font-size: 12px; }
.ma-btn.active .ma-btn-text { color: #fff; }
.right-btn-group { display: flex; flex-direction: row; align-items: center; }
.settings-btn {
  background-color: #fdecea;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  padding: 4px 10px;
  margin-right: 4px;
}
.settings-btn:active { background-color: #fadbd8; }
.settings-btn-text { color: #e74c3c; font-weight: 500; font-size: 12px; }
.favorite-btn {
  background-color: #e6f4ff;
  border: 1px solid #1890ff;
  border-radius: 4px;
  padding: 4px 10px;
}
.favorite-btn:active { background-color: #bae7ff; }
.favorite-btn-text { color: #1890ff; font-weight: 500; font-size: 12px; }

/* 手机窄屏：6 个开关 + 2 个按钮排成 4 列 × 2 行，避免开关挤成 3 行 */
@media (max-width: 560px) {
  .ma-favorite-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    align-items: stretch;
  }
  .ma-buttons, .right-btn-group { display: contents; }
  .ma-btn {
    margin: 0;
    padding: 6px 2px;
    justify-content: center;
    gap: 4px;
  }
  .settings-btn, .favorite-btn {
    margin: 0;
    padding: 4px 2px;
    text-align: center;
  }
}

/* 图表 */
.chart-wrapper {
  height: 560px;
  position: relative;
}
.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-size: 13px;
}

/* AI 弹窗 */
.ai-status {
  text-align: center;
  font-size: 11px;
  color: #999;
  padding: 4px 0;
}
.ai-status.err { color: #ec0000; }
.ai-body {
  max-height: 52vh;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 12px;
}
.ai-md { font-size: 13px; color: #212529; line-height: 1.7; }
.ai-md h3, .ai-md h4, .ai-md h5, .ai-md h6 { margin: 8px 0 4px; color: #212529; }
.ai-md p { margin: 4px 0; }
.ai-md ul { margin: 4px 0; padding-left: 18px; }
.ai-md li { margin: 2px 0; }
.ai-md code {
  background: #e9ecef;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 11px;
}
.ai-cursor { color: #1890ff; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }
.ai-input {
  width: 200px;
  height: 32px;
  background: #f0f2f5;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
}
.ai-prov { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.ai-prov-name { font-size: 13px; color: #333; }
.ai-prov-name.act { color: #1890ff; font-weight: 600; }
.ai-prov-model { font-size: 11px; color: #999; }
.ai-prov-ops { display: flex; flex-direction: row; gap: 10px; }
.ai-op { font-size: 12px; color: #1890ff; }
.ai-op.del { color: #ec0000; }
.hist-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid #f2f3f5;
}
.hist-name { font-size: 13px; color: #333; }
.hist-time { font-size: 11px; color: #bbb; }
.empty-hist { text-align: center; color: #bbb; font-size: 13px; padding: 20px 0; }

/* 量化演示条 */
.quant-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #f3e9fd;
  border-bottom: 1rpx solid #e0d0f5;
  padding: 6rpx 20rpx;
}
.quant-text {
  flex: 1;
  font-size: 20rpx;
  color: #5f27cd;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.quant-clear { font-size: 20rpx; color: #8e44ad; padding: 0 8rpx; }
.quant-hidden { opacity: 0.55; }

/* 底部免责（fixed 在 tabbar 上方） */
.bottom-tip {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 50px;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 15px;
  z-index: 10;
}
.bottom-tip-text { color: #999; font-size: 12px; }
.bottom-space { height: 90px; }

/* ============ 买卖点成因详情弹窗 ============ */
.mk-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #f2f3f5;
}
.mk-badge {
  font-size: 14px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  margin-right: 10px;
}
.mk-badge.mk-b { background: #fdecea; color: #ec0000; }
.mk-badge.mk-s { background: #e6f7ef; color: #00a854; }
.mk-head-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.mk-title { font-size: 15px; font-weight: 700; color: #212529; }
.mk-date { font-size: 11px; color: #999; }
.mk-close { font-size: 22px; color: #adb5bd; padding: 0 6px; }
.mk-body { max-height: 56vh; }
.blk { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.blk-label {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.blk-label.def { background: #e6f4ff; color: #1890ff; }
.blk-label.step { background: #f0f2f5; color: #495057; }
.blk-label.risk { background: #fdecea; color: #ec0000; }
.blk-text { font-size: 12px; color: #495057; line-height: 1.7; }
.data-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed #f0f0f0;
}
.data-k { font-size: 12px; color: #6c757d; }
.data-v { font-size: 12px; color: #212529; font-weight: 500; }
.data-v.hl { color: #1890ff; }

/* 功能说明弹窗 */
.explain-sheet {
  width: 82%;
  max-width: 340px;
  background: #fff;
  border-radius: 12px;
  padding: 18px 18px 16px;
  display: flex;
  flex-direction: column;
}
.ex-title { font-size: 16px; font-weight: 700; color: #212529; margin-bottom: 8px; }
.ex-text { font-size: 13px; color: #495057; line-height: 1.7; }
.ex-pt { display: flex; flex-direction: row; margin-top: 6px; }
.ex-dot { color: #1890ff; font-size: 12px; margin-right: 6px; flex-shrink: 0; }
.ex-pt-text { flex: 1; font-size: 12px; color: #6c757d; line-height: 1.6; }
.ex-close {
  margin-top: 14px;
  height: 38px;
  line-height: 38px;
  text-align: center;
  background: #1890ff;
  color: #fff;
  border-radius: 19px;
  font-size: 14px;
}

/* 通达信公式弹窗 */
.tdx-textarea {
  width: 100%;
  height: 180px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  font-family: Consolas, monospace;
  color: #212529;
  box-sizing: border-box;
}
.tdx-error {
  color: #ec0000;
  font-size: 12px;
  margin-top: 8px;
}
.sheet-cancel {
  margin-top: 10px;
  height: 38px;
  line-height: 38px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
}

/* 开关 ⓘ */
.ma-btn-text { color: #495057; font-weight: 500; font-size: 12px; }
.ma-btn.active .ma-btn-text { color: #fff; }
.ma-info {
  font-size: 11px;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 11px;
  color: #1890ff;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #1890ff;
  flex-shrink: 0;
}
.ma-btn.active .ma-info { color: #fff; background: rgba(255, 255, 255, 0.3); border-color: rgba(255,255,255,0.5); }

/* ============ 缠论设置弹层（小号居中弹窗，对照原站） ============ */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet {
  width: 86%;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px 16px;
  max-height: 68vh;
  display: flex;
  flex-direction: column;
}
.sheet-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
  padding-bottom: 10px;
  border-bottom: 1px solid #f2f3f5;
}
.sheet-body { max-height: 46vh; }
.set-group {
  font-size: 14px;
  font-weight: 600;
  color: #212529;
  padding: 14px 0 6px;
}
.set-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}
.set-label { font-size: 13px; color: #495057; }
.set-sub { font-size: 11px; color: #e74c3c; }
.set-tip {
  font-size: 11px;
  color: #adb5bd;
  line-height: 1.5;
  padding: 2px 0 6px;
  border-bottom: 1px solid #f8f9fa;
}
.seg { display: flex; border: 1px solid #1890ff; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
.seg-item { padding: 5px 12px; font-size: 12px; color: #1890ff; }
.seg-item.on { background: #1890ff; color: #fff; }
.sheet-reset {
  text-align: center;
  color: #e74c3c;
  font-size: 13px;
  padding: 12px 0 4px;
}
.sheet-close {
  margin-top: 8px;
  height: 42px;
  line-height: 42px;
  text-align: center;
  background: #1890ff;
  color: #fff;
  border-radius: 21px;
  font-size: 15px;
}
</style>
