<template>
  <view class="page">
    <!-- 答题中 -->
    <view v-if="!finished" class="quiz">
      <view class="progress-row">
        <text class="progress-text">{{ idx + 1 }} / {{ list.length }}</text>
        <text class="progress-set">{{ setName }}</text>
        <text class="progress-score">得分 {{ score }}</text>
      </view>
      <view class="q-card">
        <text class="q-title">{{ list[idx].q }}</text>
        <view
          v-for="(opt, j) in list[idx].opts"
          :key="j"
          class="opt"
          :class="optClass(j)"
          @click="pick(j)"
        >
          <text class="opt-letter">{{ 'ABCD'[j] }}</text>
          <text class="opt-text">{{ opt }}</text>
          <text v-if="picked !== null && j === list[idx].ans" class="opt-mark">✓</text>
          <text v-else-if="picked === j" class="opt-mark wrong">✗</text>
        </view>
      </view>
      <view v-if="picked !== null" class="explain">
        <text class="explain-title" :class="picked === list[idx].ans ? 'ok' : 'bad'">
          {{ picked === list[idx].ans ? '✓ 回答正确' : '✗ 回答错误' }}
        </text>
        <text class="explain-text">{{ list[idx].exp }}</text>
      </view>
      <view class="btn-row">
        <view class="btn btn-ghost" @click="quit">退出</view>
        <view class="btn btn-main" :class="{ disabled: picked === null }" @click="next">
          {{ idx + 1 === list.length ? '查看结果' : '下一题' }}
        </view>
      </view>
    </view>

    <!-- 结果页 -->
    <view v-else class="result">
      <view class="result-card">
        <text class="result-score">{{ score }}</text>
        <text class="result-total">/ {{ list.length }} 题</text>
        <view class="result-rate">
          <text class="rate-num">{{ Math.round((score / list.length) * 100) }}%</text>
          <text class="rate-label">正确率</text>
        </view>
        <text class="result-comment">{{ comment }}</text>
      </view>
      <view class="btn-row">
        <view class="btn btn-ghost" @click="quit">返回学习</view>
        <view class="btn btn-main" @click="retry">再测一次</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getQuizSet } from './quizData';
import type { Q } from './quizData';

/* ================== 题库：3 套 × 10 题 ================== */
const setName = ref('');
const list = ref<Q[]>([]);
const idx = ref(0);
const picked = ref<number | null>(null);
const score = ref(0);
const finished = ref(false);
let setKey = 'zs';

const comment = computed(() => {
  const rate = score.value / Math.max(1, list.value.length);
  if (rate === 1) return '满分！缠论基础扎实，可在实盘级别中小心验证。';
  if (rate >= 0.8) return '优秀。概念已经成体系，重点复盘错题对应的知识卡。';
  if (rate >= 0.6) return '良好。建议重读学习页中对应章节，再测巩固。';
  return '需要加强。把「学习」页的知识点卡片逐条过一遍，再来挑战。';
});

const STAT_KEY = 'CL_QUIZ_STATS';
function recordStat(correct: boolean) {
  try {
    const s = (uni.getStorageSync(STAT_KEY) as any) || { answered: 0, correct: 0, tests: 0 };
    s.answered += 1;
    if (correct) s.correct += 1;
    uni.setStorageSync(STAT_KEY, s);
  } catch { /* ignore */ }
}
function recordTest() {
  try {
    const s = (uni.getStorageSync(STAT_KEY) as any) || { answered: 0, correct: 0, tests: 0 };
    s.tests += 1;
    uni.setStorageSync(STAT_KEY, s);
  } catch { /* ignore */ }
}

function pick(j: number) {
  if (picked.value !== null) return; // 已答锁定
  picked.value = j;
  const ok = j === list.value[idx.value].ans;
  if (ok) score.value += 1;
  recordStat(ok);
}
function next() {
  if (picked.value === null) return;
  if (idx.value + 1 < list.value.length) {
    idx.value += 1;
    picked.value = null;
  } else {
    finished.value = true;
    recordTest();
  }
}
function retry() {
  idx.value = 0;
  picked.value = null;
  score.value = 0;
  finished.value = false;
}
function quit() {
  uni.navigateBack();
}

function optClass(j: number) {
  if (picked.value === null) return '';
  if (j === list.value[idx.value].ans) return 'right';
  if (j === picked.value) return 'wrong';
  return 'dim';
}

onLoad((opts: any) => {
  setKey = (opts?.set as string) || 'zs';
  const set = getQuizSet(setKey);
  setName.value = set.name;
  list.value = set.qs;
  uni.setNavigationBarTitle({ title: set.name });
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 12px;
}
/* 进度行 */
.progress-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.progress-text { font-size: 15px; font-weight: 700; color: #212529; }
.progress-set { font-size: 12px; color: #6c757d; }
.progress-score { font-size: 12px; color: #1890ff; font-weight: 600; }

/* 题目卡 */
.q-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 14px;
}
.q-title { font-size: 15px; font-weight: 600; color: #212529; line-height: 1.6; }
.opt {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 11px 12px;
  margin-top: 10px;
}
.opt-letter {
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 10px;
  background: #f0f2f5;
  color: #6c757d;
  font-size: 11px;
  margin-right: 10px;
  flex-shrink: 0;
}
.opt-text { flex: 1; font-size: 13px; color: #333; line-height: 1.6; }
.opt.right { border-color: #00a854; background: #f0faf5; }
.opt.right .opt-letter { background: #00a854; color: #fff; }
.opt.wrong { border-color: #ec0000; background: #fef2f2; }
.opt.wrong .opt-letter { background: #ec0000; color: #fff; }
.opt.dim { opacity: 0.55; }
.opt-mark { color: #00a854; font-size: 13px; font-weight: 700; margin-left: 6px; }
.opt-mark.wrong { color: #ec0000; }

/* 解析 */
.explain {
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.explain-title { font-size: 13px; font-weight: 700; }
.explain-title.ok { color: #00a854; }
.explain-title.bad { color: #ec0000; }
.explain-text { font-size: 12px; color: #495057; line-height: 1.7; }

/* 按钮 */
.btn-row {
  display: flex;
  flex-direction: row;
  gap: 10px;
  margin-top: 14px;
}
.btn {
  flex: 1;
  height: 44px;
  line-height: 44px;
  text-align: center;
  border-radius: 22px;
  font-size: 15px;
}
.btn-ghost { background: #fff; color: #6c757d; border: 1px solid #dee2e6; }
.btn-main { background: #1890ff; color: #fff; font-weight: 600; }
.btn-main.disabled { opacity: 0.5; }

/* 结果页 */
.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 30px;
}
.result-score { font-size: 52px; font-weight: 700; color: #1890ff; line-height: 1; }
.result-total { font-size: 14px; color: #999; margin-top: 4px; }
.result-rate { display: flex; flex-direction: row; align-items: baseline; gap: 6px; margin-top: 14px; }
.rate-num { font-size: 22px; font-weight: 700; color: #212529; }
.rate-label { font-size: 12px; color: #999; }
.result-comment { font-size: 13px; color: #495057; line-height: 1.7; text-align: center; margin-top: 12px; }
</style>
