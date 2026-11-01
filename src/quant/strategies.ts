/**
 * 量化演示策略计算（趋势跟踪 / 均值回归 / 动量 / 突破）
 * 输入K线，输出买卖信号标记与简化回测统计。
 */
import type { KLine } from '../api/cnfin';

export interface QuantMark {
  day: string;
  price: number;
  dir: 'B' | 'S';
}

export interface QuantStats {
  trades: number;
  wins: number;
  winRate: number;
  pnlPct: number;
}

export interface QuantResult {
  marks: QuantMark[];
  stats: QuantStats;
}

const sma = (vals: number[], k: number): (number | null)[] => {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= k) sum -= vals[i - k];
    out.push(i >= k - 1 ? sum / k : null);
  }
  return out;
};

const ema = (vals: number[], k: number): (number | null)[] => {
  const out: (number | null)[] = [];
  const w = 2 / (k + 1);
  let acc = 0;
  for (let i = 0; i < vals.length; i++) {
    acc = i === 0 ? vals[0] : vals[i] * w + acc * (1 - w);
    out.push(acc);
  }
  return out;
};

const rsi = (closes: number[], k = 14): (number | null)[] => {
  const out: (number | null)[] = [null];
  let avgUp = 0, avgDn = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const up = Math.max(0, diff), dn = Math.max(0, -diff);
    if (i <= k) {
      avgUp = (avgUp * (i - 1) + up) / i;
      avgDn = (avgDn * (i - 1) + dn) / i;
      out.push(i === k ? (avgDn === 0 ? 100 : 100 - 100 / (1 + avgUp / avgDn)) : null);
    } else {
      avgUp = (avgUp * (k - 1) + up) / k;
      avgDn = (avgDn * (k - 1) + dn) / k;
      out.push(avgDn === 0 ? 100 : 100 - 100 / (1 + avgUp / avgDn));
    }
  }
  return out;
};

const stdev = (vals: number[], k: number): (number | null)[] => {
  const mid = sma(vals, k);
  return vals.map((_, i) => {
    if (i < k - 1 || mid[i] === null) return null;
    let s = 0;
    for (let j = i - k + 1; j <= i; j++) s += (vals[j] - (mid[i] as number)) ** 2;
    return Math.sqrt(s / k);
  });
};

/** 简单回测：B 开仓 / S 平仓（全仓逐对），返回统计 */
function backtest(kl: KLine[], raw: QuantMark[]): QuantResult {
  // 同日同向去重；连续同向只保留第一个
  const marks: QuantMark[] = [];
  let lastDir: 'B' | 'S' | null = null;
  for (const m of raw) {
    if (m.dir === lastDir) continue;
    marks.push(m);
    lastDir = m.dir;
  }
  // 若首标记为 S（无持仓可卖）则丢弃
  while (marks.length && marks[0].dir === 'S') marks.shift();
  // 回测
  let trades = 0, wins = 0, pnl = 0;
  let entry: number | null = null;
  for (const m of marks) {
    if (m.dir === 'B') entry = m.price;
    else if (entry) {
      const r = m.price / entry - 1;
      pnl += r;
      trades += 1;
      if (r > 0) wins += 1;
      entry = null;
    }
  }
  return {
    marks,
    stats: {
      trades,
      wins,
      winRate: trades ? Math.round((wins / trades) * 100) : 0,
      pnlPct: Math.round(pnl * 1000) / 10,
    },
  };
}

/** 双均线交叉（默认 5/20）：金叉买入、死叉卖出 */
export function strategyMaCross(kl: KLine[], fast = 5, slow = 20): QuantResult {
  const closes = kl.map((k) => k.close);
  const f = sma(closes, fast), s = sma(closes, slow);
  const raw: QuantMark[] = [];
  for (let i = 1; i < kl.length; i++) {
    if (f[i] === null || s[i] === null || f[i - 1] === null || s[i - 1] === null) continue;
    if ((f[i - 1] as number) <= (s[i - 1] as number) && (f[i] as number) > (s[i] as number)) {
      raw.push({ day: kl[i].day, price: kl[i].close, dir: 'B' });
    } else if ((f[i - 1] as number) >= (s[i - 1] as number) && (f[i] as number) < (s[i] as number)) {
      raw.push({ day: kl[i].day, price: kl[i].close, dir: 'S' });
    }
  }
  return backtest(kl, raw);
}

/** 布林带均值回归（20±2σ）：跌破下轨买入、回到中轨卖出 */
export function strategyBoll(kl: KLine[], k = 20, mult = 2): QuantResult {
  const closes = kl.map((x) => x.close);
  const mid = sma(closes, k), sd = stdev(closes, k);
  const raw: QuantMark[] = [];
  let holding = false;
  for (let i = 0; i < kl.length; i++) {
    if (mid[i] === null || sd[i] === null) continue;
    const lower = (mid[i] as number) - mult * (sd[i] as number);
    if (!holding && closes[i] < lower) {
      raw.push({ day: kl[i].day, price: closes[i], dir: 'B' });
      holding = true;
    } else if (holding && closes[i] >= (mid[i] as number)) {
      raw.push({ day: kl[i].day, price: closes[i], dir: 'S' });
      holding = false;
    }
  }
  return backtest(kl, raw);
}

/** RSI 超买超卖（14）：从 <30 回升买入、从 >70 回落卖出 */
export function strategyRsi(kl: KLine[], k = 14): QuantResult {
  const closes = kl.map((x) => x.close);
  const r = rsi(closes, k);
  const raw: QuantMark[] = [];
  let holding = false;
  for (let i = 1; i < kl.length; i++) {
    if (r[i] === null || r[i - 1] === null) continue;
    const prev = r[i - 1] as number, cur = r[i] as number;
    if (!holding && prev < 30 && cur >= 30) {
      raw.push({ day: kl[i].day, price: closes[i], dir: 'B' });
      holding = true;
    } else if (holding && prev > 70 && cur <= 70) {
      raw.push({ day: kl[i].day, price: closes[i], dir: 'S' });
      holding = false;
    }
  }
  return backtest(kl, raw);
}

/** 唐奇安通道突破（海龟核心）：突破 N 日最高买入、跌破 M 日最低卖出 */
export function strategyTurtle(kl: KLine[], entryN = 20, exitN = 10): QuantResult {
  const highs = kl.map((x) => x.high), lows = kl.map((x) => x.low);
  const raw: QuantMark[] = [];
  let holding = false;
  for (let i = entryN; i < kl.length; i++) {
    if (!holding) {
      const hh = Math.max(...highs.slice(i - entryN, i));
      if (kl[i].close > hh) {
        raw.push({ day: kl[i].day, price: kl[i].close, dir: 'B' });
        holding = true;
      }
    } else {
      const ll = Math.min(...lows.slice(i - exitN, i));
      if (kl[i].close < ll) {
        raw.push({ day: kl[i].day, price: kl[i].close, dir: 'S' });
        holding = false;
      }
    }
  }
  return backtest(kl, raw);
}

export const QUANT_STRATEGIES = [
  {
    key: 'ma_cross' as const,
    name: '双均线交叉',
    system: '趋势跟踪',
    desc: '短均线上穿长均线（金叉）买入，下穿（死叉）卖出。最经典的趋势跟踪策略，在单边行情中表现好，震荡市会反复止损。',
    detail: '本演示使用 MA5 与 MA20。信号次数与行情趋势性正相关；适合右侧交易者。',
  },
  {
    key: 'boll' as const,
    name: '布林带均值回归',
    system: '均值回归',
    desc: '价格跌破布林下轨（20日±2σ）买入，回归中轨卖出。假设价格围绕均值波动，极端偏离会被修复。',
    detail: '与趋势策略互补：震荡市胜率高，单边下跌会连续抄底——需配合止损。',
  },
  {
    key: 'rsi' as const,
    name: 'RSI 超买超卖',
    system: '动量/均值回归',
    desc: 'RSI(14) 从 30 以下回升买入（超卖修复），从 70 以上回落卖出（超买回落）。',
    detail: '动量类经典指标策略。强趋势中超卖会钝化，需注意与趋势方向配合。',
  },
  {
    key: 'turtle' as const,
    name: '唐奇安通道突破（海龟）',
    system: '趋势跟踪',
    desc: '海龟交易法则核心：收盘价突破 20 日最高价买入，跌破 10 日最低价卖出。',
    detail: '系统一（短周期突破）。趋势市利润丰厚、震荡市磨损大；历史上配合仓位管理与 2N 止损使用。',
  },
];

export function runQuant(key: string, kl: KLine[]): QuantResult {
  switch (key) {
    case 'boll': return strategyBoll(kl);
    case 'rsi': return strategyRsi(kl);
    case 'turtle': return strategyTurtle(kl);
    default: return strategyMaCross(kl);
  }
}
