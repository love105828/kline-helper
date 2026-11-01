/** 缠论算法测试：真实上证指数日K（2020-11 → 2026-10，1440根） */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeChan } from '../src/chan/index';
import { mergeKlines } from '../src/chan/merge';
import { findFractals } from '../src/chan/fenxing';
import { buildStrokes } from '../src/chan/bi';
import { buildSegments } from '../src/chan/duan';
import type { KLine } from '../src/chan/types';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const klines: KLine[] = JSON.parse(
  readFileSync(join(ROOT, 'tests', 'fixtures', 'sh000001-day.json'), 'utf-8'),
);

describe('夹具数据', () => {
  it('上证日K 1440 根', () => {
    expect(klines.length).toBe(1440);
    expect(klines[0].day).toBe('2020-11-13');
  });
});

describe('K线包含合并', () => {
  const merged = mergeKlines(klines);
  it('合并后数量减少且相邻无包含', () => {
    expect(merged.length).toBeLessThan(klines.length);
    expect(merged.length).toBeGreaterThan(800);
    for (let i = 1; i < merged.length; i++) {
      const a = merged[i - 1], b = merged[i];
      const inclA = b.high >= a.high && b.low <= a.low;
      const inclB = b.high <= a.high && b.low >= a.low;
      expect(inclA || inclB).toBe(false);
    }
  });
  it('极值日都能映射回原始K线', () => {
    const days = new Set(klines.map((k) => k.day));
    for (const b of merged) {
      expect(days.has(b.highDay)).toBe(true);
      expect(days.has(b.lowDay)).toBe(true);
    }
  });
});

describe('分型与笔', () => {
  const merged = mergeKlines(klines);
  const fxs = findFractals(merged);
  const { confirmed, virtual } = buildStrokes(fxs, 4);

  it('分型数量合理', () => {
    expect(fxs.length).toBeGreaterThan(200);
  });
  it('笔端点顶底交替', () => {
    for (let i = 1; i < confirmed.length; i++) {
      expect(confirmed[i].kind).not.toBe(confirmed[i - 1].kind);
    }
  });
  it('笔端点间隔 >= gap 且顶高于相邻底', () => {
    for (let i = 1; i < confirmed.length; i++) {
      expect(Math.abs(confirmed[i].i - confirmed[i - 1].i)).toBeGreaterThanOrEqual(4);
    }
    for (let i = 1; i < confirmed.length; i++) {
      const [a, b] = [confirmed[i - 1], confirmed[i]];
      if (a.kind === 'top') expect(b.price).toBeLessThan(a.price);
      else expect(b.price).toBeGreaterThan(a.price);
    }
  });
  it('笔数量在合理区间（6年日K 约 100-300 笔）', () => {
    expect(confirmed.length).toBeGreaterThan(50);
    expect(confirmed.length).toBeLessThan(400);
  });
  it('虚笔端点晚于最后一个确认端点', () => {
    if (virtual) expect(virtual.i).toBeGreaterThan(confirmed[confirmed.length - 1].i);
  });
});

describe('线段', () => {
  const merged = mergeKlines(klines);
  const fxs = findFractals(merged);
  const { confirmed, virtual } = buildStrokes(fxs, 4);
  const points = virtual ? [...confirmed, virtual] : confirmed;
  const { segments } = buildSegments(points, 3);

  it('段端点是笔端点的子序列且方向交替', () => {
    expect(segments.length).toBeGreaterThan(4);
    for (let i = 1; i < segments.length; i++) {
      const prevIdx = segments[i - 1]._idx, curIdx = segments[i]._idx;
      expect(curIdx).toBeGreaterThan(prevIdx);
    }
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].kind).not.toBe(segments[i - 1].kind);
    }
  });
});

describe('整体分析 computeChan', () => {
  const draw = computeChan(klines, { gap: 4 });

  it('输出结构完整', () => {
    expect(draw.stroke.length).toBeGreaterThan(50);
    expect(draw.segment.length).toBeGreaterThan(4);
    expect(draw.macd.dif.length).toBe(klines.length);
    expect(draw.macd.hist.length).toBe(klines.length);
  });
  it('所有笔/段节点日期都存在于原始K线', () => {
    const days = new Set(klines.map((k) => k.day));
    for (const row of [...draw.stroke, ...draw.segment, ...draw.vstroke]) {
      expect(days.has(row[0])).toBe(true);
    }
  });
  it('中枢满足 zd < zg，且框边界日期有效', () => {
    expect(draw.strokebox.length).toBeGreaterThan(5);
    const days = new Set(klines.map((k) => k.day));
    for (const box of draw.strokebox) {
      expect(box.zd).toBeLessThan(box.zg);
      expect(days.has(box.d0)).toBe(true);
      expect(days.has(box.d1)).toBe(true);
      expect(box.n).toBeGreaterThanOrEqual(3);
    }
    for (const box of draw.segmentbox) {
      expect(box.zd).toBeLessThan(box.zg);
    }
  });
  it('虚笔/虚段为两节点且末节点带标签', () => {
    if (draw.vstroke.length) {
      expect(draw.vstroke.length).toBe(2);
      expect(draw.vstroke[1][4]).toBe('虚笔');
    }
    if (draw.vsegment.length) {
      expect(draw.vsegment.length).toBe(2);
      expect(draw.vsegment[1][4]).toBe('虚段');
    }
  });
  it('买卖点标记日期有效且类型合法', () => {
    const days = new Set(klines.map((k) => k.day));
    const types = new Set(['B1', 'S1', 'B2', 'S2', 'B3', 'S3']);
    for (const mk of draw.markers) {
      expect(days.has(mk.day)).toBe(true);
      expect(types.has(mk.type)).toBe(true);
    }
  });
  it('现价线为最新收盘价', () => {
    expect(draw.line[0].point).toBeCloseTo(klines[klines.length - 1].close, 3);
  });
  it('宽松笔(新笔)比严格笔(老笔)产生更多笔', () => {
    const loose = computeChan(klines, { gap: 3 });
    expect(loose.stroke.length).toBeGreaterThanOrEqual(draw.stroke.length);
  });
});
