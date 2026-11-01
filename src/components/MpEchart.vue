<template>
  <canvas
    id="mp-ec"
    type="2d"
    class="mp-ec"
    @touchstart="onTouch"
    @touchmove="onTouch"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  ></canvas>
</template>

<script lang="ts">
/**
 * 小程序 ECharts 容器（微信 canvas 2d 模式）
 * 仅在 MP-WEIXIN 条件编译分支中被引用。
 * - 初始化：拿 canvas node → echarts.init(node, null, { width, height, dpr })
 * - 触摸：把 wx 触摸事件转发给 zrender（crosshair/inside dataZoom 手势可用）
 * - 暴露：setOption / getChart
 */
import * as echarts from 'echarts/core';

export default {
  props: { option: { type: Object, default: null } },
  emits: ['inited'],
  data() {
    return { chart: null as any };
  },
  watch: {
    option: {
      handler(v: any) {
        if (v && this.chart) this.chart.setOption(v, true);
      },
      deep: false,
    },
  },
  mounted() {
    // #ifdef MP-WEIXIN
    const query = (uni as any).createSelectorQuery().in(this);
    query
      .select('#mp-ec')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        const info = res && res[0];
        if (!info || !info.node) return;
        const { node, width, height } = info;
        const dpr = (uni.getSystemInfoSync() as any).pixelRatio || 2;
        node.width = width * dpr;
        node.height = height * dpr;
        const chart = echarts.init(node, null, {
          width, height,
          devicePixelRatio: dpr,
        });
        if (this.option) chart.setOption(this.option, true);
        this.chart = chart;
        this.$emit('inited', chart);
      });
    // #endif
  },
  methods: {
    setOption(option: any) {
      if (this.chart) this.chart.setOption(option, true);
    },
    getChart() {
      return this.chart;
    },
    /** 把 wx 触摸事件映射为 zrender 鼠标事件（tap=mousemove、抬手=mouseup） */
    onTouch(e: any) {
      const chart = this.chart;
      if (!chart) return;
      const zr = chart.getZr();
      const touches = e.touches || (e.changedTouches || []);
      if (!touches.length) return;
      // canvas 内坐标：touch.x/y 相对 canvas
      const t = touches[0];
      const x = t.x ?? 0;
      const y = t.y ?? 0;
      if (e.type === 'touchstart') { this._downX = x; this._downY = y; }
      zr.handler.dispatch('mousemove', { zrX: x, zrY: y });
    },
    onTouchEnd(e: any) {
      const chart = this.chart;
      if (!chart) return;
      const zr = chart.getZr();
      const touches = e.changedTouches || [];
      const t = touches[0] || { x: -10, y: -10 };
      const x = t.x ?? -10;
      const y = t.y ?? -10;
      // 轻点（位移小）补发 down/up/click 序列 → zrender 识别为 click（买卖点标记可点）
      const dx = Math.abs(x - (this._downX ?? x));
      const dy = Math.abs(y - (this._downY ?? y));
      if (dx < 8 && dy < 8) {
        zr.handler.dispatch('mousedown', { zrX: x, zrY: y });
        zr.handler.dispatch('mouseup', { zrX: x, zrY: y });
        zr.handler.dispatch('click', { zrX: x, zrY: y });
      } else {
        zr.handler.dispatch('mouseup', { zrX: x, zrY: y });
      }
    },
  },
};
</script>

<style scoped>
.mp-ec {
  width: 100%;
  height: 100%;
}
</style>
