/** 5. 中枢：三元素重合区间 + 延伸 + 破坏关闭 */
import type { ChanBox, Fenxing } from './types';

type Pt = Fenxing | (Fenxing & { _idx?: number });

const range = (points: Pt[], j: number): [number, number] => {
  const p0 = points[j].price, p1 = points[j + 1].price;
  return [Math.min(p0, p1), Math.max(p0, p1)];
};

/**
 * 在元素端点区间 [a, b) 内构建中枢。
 * 元素 j 的区间 = 端点 j 与 j+1 的价格连线区间。
 * 三个连续元素重合（zd < zg）成中枢；extend=true 时后续元素与 [zd, zg]
 * 有重叠则延伸（更新 GG/DD），无重叠则关闭；extend=false 仅取前三元素。
 */
export function buildPivots(points: Pt[], a: number, b: number, labelUnit: '笔' | '段', extend = true): ChanBox[] {
  const res: ChanBox[] = [];
  let k = a + 1; // 第一元素视为进入元素，从第二元素起找重合
  // 元素 j 需要 points[j] 与 points[j+1]，b 为最后一个合法索引
  while (k + 3 <= b) {
    const rs = [range(points, k), range(points, k + 1), range(points, k + 2)];
    const zg = Math.min(rs[0][1], rs[1][1], rs[2][1]);
    const zd = Math.max(rs[0][0], rs[1][0], rs[2][0]);
    if (zd >= zg) {
      k += 1;
      continue;
    }
    let gg = zg, dd = zd;
    let end = k + 2;
    if (extend) {
      let j = k + 3;
      while (j + 1 <= b) {
        const [lo, hi] = range(points, j);
        if (lo > zg || hi < zd) break;
        gg = Math.max(gg, hi);
        dd = Math.min(dd, lo);
        end = j;
        j += 1;
      }
    }
    res.push({
      d0: points[k].day,
      d1: points[Math.min(end + 1, points.length - 1)].day,
      zg, zd, gg, dd,
      n: end - k + 1,
      label: `${end - k + 1} ${labelUnit}`,
    });
    k = end + 1;
  }
  return res;
}
