/**
 * 通达信公式解释器（MVP）
 * 支持：
 *   语句    NAME:EXPR;（输出线）  NAME:=EXPR;（中间变量）
 *   变量    CLOSE/C OPEN/O HIGH/H LOW/L VOL/V 以及先前定义的变量
 *   函数    MA EMA SMA REF HHV LLV CROSS COUNT EVERY EXIST BARSLAST
 *           MAX MIN ABS IF NOT MOD POW SQRT SUM
 *   运算    + - * / > < >= <= = == AND OR NOT 一元负号
 *   注释    { } 与行尾 //
 * 不支持：DRAW* 绘图函数（忽略该语句）、BACKSET/WINNER 等系统函数（报错提示）
 */

export interface TdxLine {
  name: string;
  values: (number | null)[];
  /** 是否信号线（全部值 ∈ {0,1} 且来自 CROSS 类比较） */
  signal?: boolean;
}

export interface TdxResult {
  lines: TdxLine[];
  error?: string;
}

type Series = (number | null)[];

const FN_SET = new Set([
  'MA', 'EMA', 'SMA', 'REF', 'HHV', 'LLV', 'CROSS', 'COUNT', 'EVERY', 'EXIST',
  'BARSLAST', 'MAX', 'MIN', 'ABS', 'IF', 'NOT', 'MOD', 'POW', 'SQRT', 'SUM',
]);

/* ---------------- 词法 ---------------- */
type Tok = { t: 'num' | 'id' | 'op' | 'eof'; v: string };

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src.replace(/\{[^}]*\}/g, ' ').replace(/\/\/[^\n]*/g, ' ');
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j).toUpperCase() });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === ':=' || two === '<>' || two === '==') {
      toks.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    toks.push({ t: 'op', v: ch });
    i++;
  }
  toks.push({ t: 'eof', v: '' });
  return toks;
}

/* ---------------- 序列运算工具 ---------------- */
const nul = (n: number): Series => new Array(n).fill(null);
const map2 = (a: Series, b: Series, f: (x: number, y: number) => number): Series =>
  a.map((x, i) => (x === null || b[i] === null ? null : f(x, b[i] as number)));
const map1 = (a: Series, f: (x: number) => number): Series => a.map((x) => (x === null ? null : f(x)));
const bool2n = (b: boolean): number => (b ? 1 : 0);
const isSignal = (s: Series): boolean => s.length > 0 && s.every((v) => v === null || v === 0 || v === 1);

/* ---------------- 语法分析 ---------------- */
function parseExpr(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: { open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }): Series {
  return parseOr(toks, pos, n, vars, bars);
}
function peekOp(toks: Tok[], pos: { p: number }, ...ops: string[]): string | null {
  const t = toks[pos.p];
  if (t && t.t === 'op' && ops.includes(t.v)) return t.v;
  return null;
}
function expect(toks: Tok[], pos: { p: number }, op: string) {
  if (peekOp(toks, pos, op) === null) throw new Error(`期望 "${op}"`);
  pos.p++;
}

function parseOr(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  let left = parseAnd(toks, pos, n, vars, bars);
  while (peekOp(toks, pos, 'OR') !== null || (toks[pos.p].t === 'id' && toks[pos.p].v === 'OR')) {
    pos.p++;
    const right = parseAnd(toks, pos, n, vars, bars);
    left = map2(left, right, (x, y) => bool2n(x !== 0 || y !== 0));
  }
  return left;
}
function parseAnd(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  let left = parseCmp(toks, pos, n, vars, bars);
  while (toks[pos.p].t === 'id' && toks[pos.p].v === 'AND') {
    pos.p++;
    const right = parseCmp(toks, pos, n, vars, bars);
    left = map2(left, right, (x, y) => bool2n(x !== 0 && y !== 0));
  }
  return left;
}
function parseCmp(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  let left = parseAdd(toks, pos, n, vars, bars);
  for (;;) {
    const op = peekOp(toks, pos, '>', '<', '>=', '<=', '=', '==', '<>');
    if (!op) break;
    pos.p++;
    const right = parseAdd(toks, pos, n, vars, bars);
    left = map2(left, right, (x, y) => {
      switch (op) {
        case '>': return bool2n(x > y);
        case '<': return bool2n(x < y);
        case '>=': return bool2n(x >= y);
        case '<=': return bool2n(x <= y);
        case '=': case '==': return bool2n(Math.abs(x - y) < 1e-9);
        case '<>': return bool2n(Math.abs(x - y) >= 1e-9);
        default: return 0;
      }
    });
  }
  return left;
}
function parseAdd(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  let left = parseMul(toks, pos, n, vars, bars);
  for (;;) {
    const op = peekOp(toks, pos, '+', '-');
    if (!op) break;
    pos.p++;
    const right = parseMul(toks, pos, n, vars, bars);
    left = map2(left, right, (x, y) => (op === '+' ? x + y : x - y));
  }
  return left;
}
function parseMul(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  let left = parseUnary(toks, pos, n, vars, bars);
  for (;;) {
    const op = peekOp(toks, pos, '*', '/');
    if (!op) break;
    pos.p++;
    const right = parseUnary(toks, pos, n, vars, bars);
    left = map2(left, right, (x, y) => (op === '*' ? x * y : y === 0 ? 0 : x / y));
  }
  return left;
}
function parseUnary(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  if (peekOp(toks, pos, '-')) {
    pos.p++;
    return map1(parseUnary(toks, pos, n, vars, bars), (x) => -x);
  }
  if (peekOp(toks, pos, '+')) {
    pos.p++;
    return parseUnary(toks, pos, n, vars, bars);
  }
  if (toks[pos.p].t === 'id' && toks[pos.p].v === 'NOT') {
    pos.p++;
    return map1(parseUnary(toks, pos, n, vars, bars), (x) => bool2n(x === 0));
  }
  return parsePrimary(toks, pos, n, vars, bars);
}

function parsePrimary(toks: Tok[], pos: { p: number }, n: number, vars: Map<string, Series>, bars: any): Series {
  const t = toks[pos.p];
  if (t.t === 'num') {
    pos.p++;
    const v = parseFloat(t.v);
    return new Array(n).fill(Number.isFinite(v) ? v : null);
  }
  if (t.t === 'op' && t.v === '(') {
    pos.p++;
    const e = parseExpr(toks, pos, n, vars, bars);
    expect(toks, pos, ')');
    return e;
  }
  if (t.t === 'id') {
    const name = t.v;
    pos.p++;
    // 变量
    const BARS: Record<string, number[]> = {
      CLOSE: bars.close, C: bars.close,
      OPEN: bars.open, O: bars.open,
      HIGH: bars.high, H: bars.high,
      LOW: bars.low, L: bars.low,
      VOL: bars.volume, V: bars.volume,
    };
    // 函数调用
    if (peekOp(toks, pos, '(')) {
      pos.p++;
      const args: Series[] = [];
      const nums: number[] = [];
      if (peekOp(toks, pos, ')') === null) {
        for (;;) {
          const before = pos.p;
          const e = parseExpr(toks, pos, n, vars, bars);
          // 常量参数（全为同一常量的序列）
          const flat = e.every((v) => v === null) ? NaN : e[0] as number;
          const isConst = e.every((v) => v !== null && v === e[0]);
          args.push(e);
          nums.push(isConst ? (flat as number) : NaN);
          if (peekOp(toks, pos, ',')) { pos.p++; continue; }
          break;
        }
      }
      expect(toks, pos, ')');
      return applyFn(name, args, nums, n, bars);
    }
    if (BARS[name]) return BARS[name].slice();
    const v = vars.get(name);
    if (v) return v.slice();
    throw new Error(`未知变量 "${name}"`);
  }
  throw new Error(`意外的符号 "${t.v || '结尾'}"`);
}

function applyFn(name: string, args: Series[], nums: number[], n: number, bars: any): Series {
  const A = (i: number): Series => args[i] ?? nul(n);
  const N = (i: number): number => {
    const v = nums[i];
    if (!Number.isFinite(v)) throw new Error(`${name} 第${i + 1}个参数需为常数`);
    return Math.round(v);
  };
  if (!FN_SET.has(name)) throw new Error(`暂不支持函数 "${name}"`);
  switch (name) {
    case 'MA': return ma(A(0), N(1));
    case 'EMA': return ema(A(0), N(1));
    case 'SMA': {
      const [x, nm, m] = [A(0), N(1), nums[2] || 1];
      const out = nul(n);
      let acc = 0;
      const w = m / nm;
      for (let i = 0; i < n; i++) {
        const v = x[i];
        acc = v === null ? acc : (i === 0 ? v : acc * (1 - w) + v * w);
        out[i] = i >= nm - 1 ? acc : null;
      }
      return out;
    }
    case 'REF': {
      const k = N(1);
      return A(0).map((_, i) => (i - k >= 0 ? A(0)[i - k] : null));
    }
    case 'HHV': {
      const k = Math.max(1, N(1));
      return A(0).map((_, i) => {
        let best: number | null = null;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) {
          const v = A(0)[j];
          if (v !== null && (best === null || v > best)) best = v;
        }
        return best;
      });
    }
    case 'LLV': {
      const k = Math.max(1, N(1));
      return A(0).map((_, i) => {
        let best: number | null = null;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) {
          const v = A(0)[j];
          if (v !== null && (best === null || v < best)) best = v;
        }
        return best;
      });
    }
    case 'CROSS': {
      const a = A(0), b = A(1);
      return a.map((_, i) => {
        if (i === 0) return null;
        const a0 = a[i - 1], a1 = a[i], b0 = b[i - 1], b1 = b[i];
        if (a0 === null || a1 === null || b0 === null || b1 === null) return null;
        return bool2n(a0 <= b0 && a1 > b1);
      });
    }
    case 'COUNT': {
      const k = Math.max(1, N(1));
      const c = A(0);
      return c.map((_, i) => {
        let cnt = 0;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) if (c[j] === 1) cnt++;
        return cnt;
      });
    }
    case 'EVERY': {
      const k = Math.max(1, N(1));
      const c = A(0);
      return c.map((_, i) => {
        let all = true;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) if (c[j] !== 1) { all = false; break; }
        return bool2n(all);
      });
    }
    case 'EXIST': {
      const k = Math.max(1, N(1));
      const c = A(0);
      return c.map((_, i) => {
        let any = false;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) if (c[j] === 1) { any = true; break; }
        return bool2n(any);
      });
    }
    case 'BARSLAST': {
      const c = A(0);
      const out = nul(n);
      let last = -1;
      for (let i = 0; i < n; i++) {
        if (c[i] === 1) last = i;
        out[i] = last === -1 ? null : i - last;
      }
      return out;
    }
    case 'MAX': return map2(A(0), A(1), (x, y) => Math.max(x, y));
    case 'MIN': return map2(A(0), A(1), (x, y) => Math.min(x, y));
    case 'ABS': return map1(A(0), Math.abs);
    case 'IF': return map2(A(0), A(1), (c, v) => (c !== 0 ? v : (A(2)[0] ?? 0)));
    case 'NOT': return map1(A(0), (x) => bool2n(x === 0));
    case 'MOD': return map2(A(0), A(1), (x, y) => (y === 0 ? 0 : x % y));
    case 'POW': return map2(A(0), A(1), (x, y) => Math.pow(x, y));
    case 'SQRT': return map1(A(0), (x) => (x >= 0 ? Math.sqrt(x) : null));
    case 'SUM': {
      const k = Math.max(1, N(1));
      const x = A(0);
      return x.map((_, i) => {
        let s = 0;
        for (let j = Math.max(0, i - k + 1); j <= i; j++) s += x[j] ?? 0;
        return s;
      });
    }
    default: throw new Error(`暂不支持函数 "${name}"`);
  }
}

function ma(x: Series, k: number): Series {
  const out = nul(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i] ?? 0;
    if (i >= k) sum -= x[i - k] ?? 0;
    out[i] = i >= k - 1 ? sum / k : null;
  }
  return out;
}
function ema(x: Series, k: number): Series {
  const out = nul(x.length);
  const w = 2 / (k + 1);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    acc = i === 0 ? (v ?? 0) : (v === null ? acc : v * w + acc * (1 - w));
    out[i] = acc;
  }
  return out;
}

/* ---------------- 入口 ---------------- */
export function runTdxFormula(source: string, bars: { open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }): TdxResult {
  try {
    const n = bars.close.length;
    const toks = lex(source);
    const vars = new Map<string, Series>();
    const lines: TdxLine[] = [];
    const pos = { p: 0 };
    while (toks[pos.p].t !== 'eof') {
      if (toks[pos.p].t === 'id' && toks[pos.p].v.startsWith('DRAW')) {
        // 绘图函数语句：跳过到分号
        while (toks[pos.p].t !== 'eof' && toks[pos.p].v !== ';') pos.p++;
        expect(toks, pos, ';');
        continue;
      }
      if (toks[pos.p].t === 'op' && toks[pos.p].v === ';') { pos.p++; continue; }
      if (toks[pos.p].t !== 'id') throw new Error(`语句应以变量名开头（位置 ${pos.p}）`);
      const name = toks[pos.p].v;
      pos.p++;
      const assign = peekOp(toks, pos, ':=', ':');
      if (!assign) throw new Error(`"${name}" 后应为 ":" 或 ":="`);
      pos.p++;
      const val = parseExpr(toks, pos, n, vars, bars);
      expect(toks, pos, ';');
      vars.set(name, val);
      if (assign === ':') {
        lines.push({ name, values: val, signal: isSignal(val) });
      }
    }
    if (!lines.length) return { lines: [], error: '没有输出线（使用 NAME:表达式; 语句输出）' };
    return { lines };
  } catch (e: any) {
    return { lines: [], error: e?.message || String(e) };
  }
}
