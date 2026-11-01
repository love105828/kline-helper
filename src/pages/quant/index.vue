<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">量化交易策略</text>
      <text class="hero-sub">主流策略体系介绍 · 内置可演示策略 · 回测仅供学习研究</text>
    </view>

    <!-- 策略体系介绍 -->
    <view v-for="(s, i) in systems" :key="i" class="card">
      <view class="card-head" @click="toggle(i)">
        <text class="card-title">{{ s.name }}</text>
        <text class="card-arrow" :class="{ open: s.open }">▾</text>
      </view>
      <view v-if="s.open" class="card-body">
        <text class="p">{{ s.desc }}</text>
        <view v-for="(pt, j) in s.points" :key="j" class="pt">
          <text class="pt-dot">•</text>
          <text class="pt-text">{{ pt }}</text>
        </view>
      </view>
    </view>

    <!-- 可演示策略 -->
    <view class="sec-label"><text class="sec-text">可演示策略（应用后在主页图上叠加信号）</text></view>
    <view v-for="(s, i) in strategies" :key="'q' + i" class="card">
      <view class="q-head">
        <view class="q-main">
          <text class="q-name">{{ s.name }}</text>
          <text class="q-sys">{{ s.system }}</text>
        </view>
        <view class="q-apply" @click="apply(s.key)">{{ applying === s.key ? '计算中…' : '在主页演示' }}</view>
      </view>
      <view class="q-body">
        <text class="q-desc">{{ s.desc }}</text>
        <text class="q-detail">{{ s.detail }}</text>
      </view>
    </view>

    <view class="footer">回测为逐对简化统计（全仓、无费用滑点），仅供学习研究，不构成任何投资建议。</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  runQuant, QUANT_STRATEGIES,
} from '../../quant/strategies';
import { fetchKline, toSymbol } from '../../api/cnfin';
import { getPrefs } from '../../utils/storage';

const systems = ref([
  {
    name: '趋势跟踪（Trend Following）', open: true,
    desc: '假设"价格趋势一旦形成便倾向于延续"，在趋势确立时入场、反转时离场。代表：海龟交易法则、双均线、MACD。',
    points: ['典型工具：均线交叉、通道突破（唐奇安）、动量排名', '优点：单边行情利润巨大、逻辑简单可机械化', '缺点：震荡市反复止损（胜率低、盈亏比高）', '关键：仓位管理与止损纪律比入场信号更重要'],
  },
  {
    name: '均值回归（Mean Reversion）', open: false,
    desc: '假设价格偏离均值后会回归，在统计极端处反向交易。代表：布林带回归、RSI 超买超卖、配对交易。',
    points: ['典型工具：布林带、RSI/KDJ、乖离率 BIAS', '优点：震荡市胜率高、持仓时间短', '缺点：趋势市"接飞刀"风险，需硬止损', '与趋势策略天然互补，可组合使用'],
  },
  {
    name: '动量策略（Momentum）', open: false,
    desc: '学术上最强的异象之一："过去 3-12 个月表现强的资产，未来仍倾向强"。横截面动量做品种轮动。',
    points: ['横截面动量：每隔 N 日买入涨幅前 20% 的品种', '时间序列动量：自身过去收益为正则持有', '在指数轮动、行业 ETF 轮动中应用广泛'],
  },
  {
    name: '统计套利与多因子', open: false,
    desc: '机构主流体系：用多因子模型（价值/成长/动量/质量/低波动）打分选股，或做配对协整套利。',
    points: ['多因子：Fama-French 三因子/五因子是学术基础', '配对交易：找两只协整的股票，价差回归时双向获利', '对数据、交易成本与执行能力要求高，个人以简化版入门'],
  },
  {
    name: '网格与做市', open: false,
    desc: '在震荡区间内低买高卖：网格交易把区间分成格子，每跌一格买一格、涨一格卖一格。',
    points: ['适合宽幅震荡的标的（指数、主流币）', '单边下跌会持续买入套牢——务必设定区间边界', '做市/高频依赖速度与成本优势，个人不建议'],
  },
]);

const strategies = QUANT_STRATEGIES;
const applying = ref('');

const apply = (key: string) => {
  if (applying.value) return;
  applying.value = key;
  const prefs = getPrefs();
  const sym = toSymbol(prefs.symbol);
  fetchKline(sym, 'day', 1440, prefs.fq)
    .then((kl) => {
      const r = runQuant(key, kl);
      if (!r.marks.length) {
        uni.showToast({ title: '该策略在本标的无信号', icon: 'none' });
        applying.value = '';
        return;
      }
      const name = strategies.find((s) => s.key === key)?.name || key;
      uni.setStorageSync('CL_QUANT_DEMO', {
        key,
        name,
        marks: r.marks,
        stats: r.stats,
        seen: false,
      });
      uni.showToast({
        title: `已计算完成（${r.marks.length} 个信号），正在打开主页…`,
        icon: 'none',
        duration: 2000,
      });
      setTimeout(() => {
        uni.switchTab({ url: '/pages/market/index' });
      }, 1200);
      applying.value = '';
    })
    .catch((e) => {
      uni.showToast({ title: '加载失败：' + (e?.message || e), icon: 'none' });
      applying.value = '';
    });
};

function toggle(i: number) {
  systems.value[i].open = !systems.value[i].open;
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 10px 10px 20px;
}
.hero {
  background: linear-gradient(135deg, #5f27cd, #8e44ad);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-title { color: #fff; font-size: 20px; font-weight: 700; }
.hero-sub { color: rgba(255, 255, 255, 0.85); font-size: 12px; }
.card {
  background: #fff;
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
}
.card-title { font-size: 15px; font-weight: 600; color: #212529; }
.card-arrow { color: #adb5bd; font-size: 13px; transition: transform 0.2s; }
.card-arrow.open { transform: rotate(180deg); }
.card-body {
  padding: 0 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.p { font-size: 13px; color: #495057; line-height: 1.7; }
.pt { display: flex; flex-direction: row; margin-top: 2px; }
.pt-dot { color: #8e44ad; font-size: 12px; margin-right: 6px; flex-shrink: 0; }
.pt-text { flex: 1; font-size: 12px; color: #495057; line-height: 1.6; }

.sec-label { padding: 16px 4px 2px; }
.sec-text { font-size: 14px; font-weight: 700; color: #5f27cd; }
.q-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px 4px;
}
.q-main { display: flex; flex-direction: column; gap: 2px; }
.q-name { font-size: 15px; font-weight: 600; color: #212529; }
.q-sys { font-size: 11px; color: #8e44ad; }
.q-apply {
  background: #5f27cd;
  color: #fff;
  font-size: 12px;
  padding: 7px 14px;
  border-radius: 15px;
}
.q-apply:active { opacity: 0.8; }
.q-body { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 4px; }
.q-desc { font-size: 12px; color: #495057; line-height: 1.6; }
.q-detail { font-size: 11px; color: #999; line-height: 1.6; }
.footer {
  text-align: center;
  color: #adb5bd;
  font-size: 11px;
  padding: 16px 0 4px;
}
</style>
