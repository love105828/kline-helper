<template>
  <view class="page">
    <view class="card">
      <!-- 排序条 -->
      <view class="sort-row">
        <view class="sort-item" :class="{ on: sort === 'default' }" @click="sort = 'default'">默认</view>
        <view class="sort-item" :class="{ on: sort === 'rate' }" @click="sort = 'rate'">涨跌幅</view>
        <view class="sort-item" :class="{ on: sort === 'price' }" @click="sort = 'price'">价格</view>
      </view>

    <!-- 表头 -->
    <view class="list-head">
      <text class="col-name">名称/代码</text>
      <text class="col-price">最新价</text>
      <text class="col-rate">涨跌幅</text>
      <text class="col-op">操作</text>
    </view>

    <!-- 列表 -->
    <scroll-view scroll-y class="list-body">
      <view v-for="item in sortedList" :key="item.code" class="list-row">
        <view class="col-name" @click="open(item)">
          <text class="row-name">{{ item.name }}</text>
          <text class="row-code">{{ item.code }}</text>
        </view>
        <text class="col-price" :class="cls(item)">{{ item.last ?? '--' }}<text class="price-unit">{{ unitOf(item.code) }}</text></text>
        <text class="col-rate" :class="cls(item)">
          {{ item.changeRate === null ? '--' : `${item.changeRate >= 0 ? '+' : ''}${item.changeRate}%` }}
        </text>
        <view class="col-op">
          <text class="op-del" @click="del(item)">删除</text>
        </view>
      </view>
      <view v-if="!list.length" class="empty">暂无收藏</view>
    </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
/** 收藏页：本地自选列表，进入时拉实时行情 */
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { fetchReal } from '../../api/cnfin';
import { getFavorites, removeFavorite, setPendingSymbol } from '../../utils/storage';
import type { FavItem } from '../../utils/storage';
import { getCurrencyInfo } from '../../utils/currency';

const unitOf = (code: string) => getCurrencyInfo(code).suffix;

interface Row extends FavItem {
  last: number | null;
  changeRate: number | null;
}

const sort = ref<'default' | 'rate' | 'price'>('default');
const list = ref<Row[]>([]);

const refresh = async () => {
  const favs = getFavorites();
  const rows: Row[] = favs.map((f) => ({ ...f, last: null, changeRate: null }));
  list.value = rows;
  await Promise.all(
    rows.map(async (r) => {
      try {
        const q = await fetchReal(r.code);
        const target = list.value.find((x) => x.code === r.code);
        if (target) {
          target.last = q.last;
          target.changeRate = q.changeRate;
        }
      } catch { /* 忽略单项失败 */ }
    }),
  );
};

const sortedList = computed(() => {
  const arr = [...list.value];
  if (sort.value === 'rate') arr.sort((a, b) => (b.changeRate ?? -999) - (a.changeRate ?? -999));
  if (sort.value === 'price') arr.sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
  return arr;
});

const cls = (r: Row) => ((r.changeRate ?? 0) > 0 ? 'up' : (r.changeRate ?? 0) < 0 ? 'down' : '');

const del = (item: Row) => {
  uni.showModal({
    title: '取消收藏',
    content: `确定删除「${item.name}」吗？`,
    success: (res) => {
      if (res.confirm) {
        removeFavorite(item.code);
        list.value = list.value.filter((x) => x.code !== item.code);
      }
    },
  });
};

const open = (item: Row) => {
  setPendingSymbol({ code: item.code, name: item.name });
  uni.switchTab({ url: '/pages/market/index' });
};

onShow(refresh);
</script>

<style scoped>
.page {
  min-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  background-color: #f5f6fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card {
  background-color: #fff;
  margin: 10px;
  border-radius: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.sort-row {
  display: flex;
  padding: 12px 16px 6px;
  gap: 20px;
}
.sort-item { font-size: 13px; color: #999; }
.sort-item.on { color: #1890ff; font-weight: 500; }

.list-head {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #f8f9fa;
  font-size: 11px;
  color: #999;
}
.list-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f2f3f5;
}
.col-name { flex: 1.4; display: flex; flex-direction: column; gap: 2rpx; }
.col-price { flex: 1; text-align: right; font-size: 15px; }
.price-unit { font-size: 10px; color: #999; font-weight: 400; margin-left: 1px; }
.col-rate { flex: 1; text-align: right; font-size: 15px; }
.col-op { flex: 0.7; text-align: right; }
.row-name { font-size: 15px; color: #333; }
.row-code { font-size: 11px; color: #bbb; }
.up { color: #e74c3c; }
.down { color: #2ead6c; }
.op-del { font-size: 13px; color: #1890ff; }
.list-body { flex: 1; min-height: 0; }
.empty {
  text-align: center;
  color: #bbb;
  font-size: 14px;
  padding-top: 120px;
}
</style>
