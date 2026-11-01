/** 缠论上下文组装（AI 提示词用），market 与 AI 页共用 */
import type { KLine } from '../api/cnfin';
import type { ChanDraw } from '../chan/types';

const tail2 = (nodes: any[][], n: number) =>
  nodes.slice(-n).map((r) => `${r[0].slice(5)}@${r[1]}`).join('、');

export function buildChanContext(
  klines: KLine[],
  draw: ChanDraw | null,
  opts: { name: string; symbol: string; period: string },
): string {
  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2] ?? last;
  const chg = prev ? Math.round((last.close / prev.close - 1) * 10000) / 100 : 0;
  const d = draw;
  const tail = (nodes: any[][], n: number) =>
    nodes.slice(-n).map((r) => `${r[0].slice(5)}@${r[1]}${r[3] === 'up' ? '↑' : r[3] === 'down' ? '↓' : ''}`).join('、');
  const pivots = d ? d.strokebox.slice(-3).map((b) => `${b.d0.slice(5)}~${b.d1.slice(5)}(区间${b.zd}-${b.zg},${b.n}笔)`).join('、') : '无';
  const marksTxt = d && d.markers.length
    ? d.markers.slice(-8).map((m) => `${m.day.slice(5)} ${m.label}@${Math.round(m.price * 100) / 100}`).join('、')
    : '无';
  const segTxt = d ? tail2(d.segment, 5) : '无';
  return [
    `标的：${opts.name}（${opts.symbol}）`,
    `周期：${opts.period}　最新收盘：${last.close}（今日 ${chg > 0 ? '+' : ''}${chg}%）`,
    `最近笔端点（日期@价格，↑顶/↓底）：${d ? tail(d.stroke, 8) : '无'}`,
    `最近段端点：${segTxt}`,
    `最近中枢（笔中枢，含区间与笔数）：${pivots}`,
    `近期买卖点标记：${marksTxt}`,
    `MACD：DIF=${d ? Math.round(d.macd.dif[d.macd.dif.length - 1] * 100) / 100 : '--'} DEA=${d ? Math.round(d.macd.dea[d.macd.dea.length - 1] * 100) / 100 : '--'}`,
  ].join('\n');
}
