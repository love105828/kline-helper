/**
 * 腾讯/东财行情源：港股 / 美股（A股由 cnfin 承担）
 * - K线: 东财 push2his（JSON，全周期，CORS 开放）— H5/小程序通用
 * - 实时: 东财 push2（JSON，UTF-8）— 替代原 qt.gtimg GBK 方案（小程序无 TextDecoder gbk）
 * - 联想: H5 用腾讯 smartbox（script 标签绕 CORS）；小程序用东财 searchapi（无 CORS 概念）
 */
import type { Period, KLine, RealQuote, SearchItem } from './cnfin';

/* ---------------- 请求封装（H5 fetch / 小程序 uni.request） ---------------- */
function getJSON<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(resolve)
      .catch(reject);
    // #endif
    // #ifndef H5
    uni.request({
      url,
      method: 'GET',
      success: (res: any) => (res.statusCode === 200 ? resolve(res.data as T) : reject(new Error(`HTTP ${res.statusCode}`))),
      fail: (err: any) => reject(new Error(err.errMsg || 'network error')),
    });
    // #endif
  });
}

/** script 标签加载（H5 专用，绕过 CORS，GBK 字符集） */
function loadScript(src: string, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    if (typeof document === 'undefined') { reject(new Error('no document')); return; }
    const s = document.createElement('script');
    s.src = src;
    s.charset = 'gbk';
    let done = false;
    const finish = (ok: boolean, err?: Error) => {
      if (done) return;
      done = true;
      s.remove();
      ok ? resolve() : reject(err ?? new Error('script fail'));
    };
    s.onload = () => finish(true);
    s.onerror = () => finish(false);
    setTimeout(() => finish(false, new Error('timeout')), timeoutMs);
    document.head.appendChild(s);
    // #endif
    // #ifndef H5
    reject(new Error('loadScript 仅限 H5'));
    // #endif
  });
}

/* ---------------- 联想（沪深/科创/创业/指数/港股/美股） ---------------- */
const TAG_MAP: Record<string, string> = { sh: '沪', sz: '深', hk: '港', us: '美' };

function entryTag(market: string, code: string): string | null {
  if (market === 'hk') {
    if (code.startsWith('1') || code.startsWith('2')) return null; // 涡轮/牛熊证
    return '港';
  }
  if (market === 'us') return '美';
  if (market === 'sh') {
    if (/^000\d{3}$/.test(code)) return null; // 指数噪音
    return code.startsWith('688') || code.startsWith('689') ? '科创' : '沪';
  }
  if (market === 'sz') {
    if (/^399\d{3}$/.test(code)) return null;
    return code.startsWith('30') ? '创业' : '深';
  }
  return null;
}

function pushUnique(out: SearchItem[], seen: Set<string>, code: string, name: string, market: SearchItem['market'], tag: string, limit: number) {
  if (seen.has(code) || out.length >= limit) return;
  seen.add(code);
  out.push({ code, name, market, tag: TAG_MAP[market] === tag ? tag : tag });
}

/** 东财联想结果 → 统一 SearchItem（QuoteID 如 116.00700 / 105.AAPL / 1.600519） */
function quoteIdToItem(quoteId: string, name: string, seen: Set<string>, out: SearchItem[], limit: number) {
  const [mkt, raw] = quoteId.split('.');
  if (!mkt || !raw) return;
  if (mkt === '1' || mkt === '2') {
    // A股/指数：东财指数与股票混排，按代码形态过滤
    if (!/^\d{6}$/.test(raw)) return;
    const market = mkt === '1' ? 'sh' : 'sz';
    const tag = entryTag(market, raw);
    if (!tag) return;
    pushUnique(out, seen, market + raw, name, market as SearchItem['market'], tag, limit);
  } else if (mkt === '116') {
    const tag = entryTag('hk', raw);
    if (!tag) return;
    pushUnique(out, seen, 'hk' + raw, name, 'hk', '港', limit);
  } else if (mkt === '105' || mkt === '106' || mkt === '107') {
    const ex = mkt === '105' ? '.OQ' : mkt === '106' ? '.N' : '.AM';
    pushUnique(out, seen, 'us' + raw.toUpperCase() + ex, name, 'us', '美', limit);
  }
}

/** 全市场搜索联想（自动适配平台）。失败时抛错，由调用方回退到内置列表。 */
export async function suggestAll(key: string, limit = 12): Promise<SearchItem[]> {
  const k = (key || '').trim();
  if (!k) return [];
  const out: SearchItem[] = [];
  const seen = new Set<string>();
  // #ifdef H5
  await loadScript(`https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(k)}&t=all`);
  const hint = (globalThis as any).v_hint;
  if (typeof hint === 'string' && hint) {
    for (const item of hint.split('^')) {
      const f = item.split('~');
      if (f.length < 5) continue;
      const [market, rawCode, name, , type] = f;
      if (!name || !rawCode) continue;
      const tag = entryTag(market, rawCode);
      if (!tag) continue;
      const code = market === 'us' ? 'us' + rawCode.toUpperCase() : market + rawCode;
      pushUnique(out, seen, code, name, market as SearchItem['market'], tag, limit);
    }
  }
  // #endif
  // #ifndef H5
  const j = await getJSON<any>(`https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(k)}&type=14&count=${limit + 10}`);
  const data = (j?.QuotationCodeTable?.Data || []) as any[];
  for (const d of data) {
    if (d.QuoteID && d.Name) quoteIdToItem(d.QuoteID, d.Name, seen, out, limit);
  }
  // #endif
  return out;
}

/* ---------------- K线（东财 push2his，全周期含分钟） ---------------- */

const EM_KLT: Record<Period, number> = {
  min1: 1, min5: 5, min15: 15, min30: 30, min60: 60,
  day: 101, week: 102, month: 103,
};

/** 统一 code → 东财 secid。us 无后缀时返回候选列表供逐一尝试 */
function toSecids(code: string): string[] {
  if (code.startsWith('hk')) return [`116.${code.slice(2)}`];
  if (code.startsWith('us')) {
    const raw = code.slice(2);
    if (raw.includes('.')) {
      const [sym, ex] = raw.split('.');
      const m: Record<string, string> = { OQ: '105', N: '106', AM: '107' };
      if (m[ex.toUpperCase()]) return [`${m[ex.toUpperCase()]}.${sym}`];
      return [`105.${sym}`, `106.${sym}`];
    }
    return [`105.${raw}`, `106.${raw}`, `107.${raw}`];
  }
  if (code.startsWith('sh')) return [`1.${code.slice(2)}`];
  if (code.startsWith('sz')) return [`0.${code.slice(2)}`];
  return [code];
}

/**
 * 港股/美股/A股日K K线（东方财富 push2his）。
 * 行格式 "datetime,open,close,high,low,volume,amount"（注意东财为开、收、高、低）。
 * 复权：fqOverride 未指定时，A股/港股不复权（fqt=0，全历史价格真实无负价）、美股前复权（fqt=1，拆股必需）。
 */
export async function fetchKlineEastmoney(code: string, period: Period, count = 1200, fqOverride?: 0 | 1 | 2): Promise<KLine[]> {
  const klt = EM_KLT[period];
  const fqt = fqOverride ?? (code.startsWith('us') ? 1 : 0);
  let lastErr: Error | null = null;
  for (const secid of toSecids(code)) {
    try {
      const url =
        `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
        `&klt=${klt}&fqt=${fqt}&beg=0&end=20500101&lmt=${count}` +
        `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
      const j = await getJSON<any>(url);
      const kl: string[] = j?.data?.klines || [];
      if (!kl.length) throw new Error('无K线数据');
      const klines = kl
        .map((line) => {
          const f = line.split(',');
          return {
            day: f[0],
            open: Number(f[1]),
            close: Number(f[2]),
            high: Number(f[3]),
            low: Number(f[4]),
            volume: Number(f[5]) || 0,
          };
        })
        .filter((k) => Number.isFinite(k.open) && k.open > 0) // 复权产生的非正值剔除
        .sort((a, b) => (a.day < b.day ? -1 : 1));
      if (klines.length) return klines;
      throw new Error('无K线数据');
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('无K线数据');
}

/* ---------------- 实时（东财 push2，JSON，双端通用） ---------------- */

/** 东财数值按 f59 精度缩放（f170 涨跌幅为 ×100 的百分数） */
function emNum(v: any, precision: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / Math.pow(10, precision)) * 10000) / 10000;
}

/** 实时快照（港股/美股；us 无交易所后缀时自动尝试 .OQ/.N/.AM） */
export async function fetchRealEastmoney(code: string): Promise<RealQuote> {
  const candidates = code.startsWith('us') && !code.slice(2).includes('.')
    ? [`${code}.OQ`, `${code}.N`, `${code}.AM`] : [code];
  let lastErr: Error | null = null;
  for (const c of candidates) {
    for (const secid of toSecids(c)) {
      try {
        const url =
          `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}` +
          `&fields=f43,f44,f45,f46,f57,f58,f59,f60,f169,f170`;
        const j = await getJSON<any>(url);
        const d = j?.data;
        if (!d || !d.f43) throw new Error('无实时数据');
        const p = Number(d.f59) || 2;
        return {
          name: d.f58 || code,
          last: emNum(d.f43, p),
          high: emNum(d.f44, p),
          low: emNum(d.f45, p),
          open: emNum(d.f46, p),
          preclose: emNum(d.f60, p),
          change: emNum(d.f169, p),
          changeRate: emNum(d.f170, 2),
        };
      } catch (e: any) {
        lastErr = e;
      }
    }
  }
  throw lastErr ?? new Error('无实时数据');
}
