/**
 * 行情数据源：中国金融信息网（新华财经）quotedata.cnfin.com
 * 与原站 taomiai.com 数据链路一致，CORS 开放，可从浏览器直连。
 * candle_period 映射已经实测验证：1=1分 2=5分 3=15分 4=30分 5=60分 6=日 7=周 8=月
 */

export type Period = 'min1' | 'min5' | 'min15' | 'min30' | 'min60' | 'day' | 'week' | 'month';

export const PERIOD_LABELS: Record<Period, string> = {
  day: '日K', week: '周K', month: '月K',
  min60: '60分', min30: '30分', min15: '15分', min5: '5分', min1: '1分',
};

/** 与原站 UI 一致的周期排列顺序 */
export const PERIOD_ORDER: Period[] = ['day', 'week', 'month', 'min60', 'min30', 'min15', 'min5', 'min1'];

const CANDLE_PERIOD: Record<Period, number> = {
  min1: 1, min5: 2, min15: 3, min30: 4, min60: 5, day: 6, week: 7, month: 8,
};

const CNFIN = 'https://quotedata.cnfin.com/quote/v1';
const KLINE_FIELDS = 'open_px,high_px,low_px,close_px,business_amount,business_balance,turnover_ratio,preclose_px,special_close_px,settlement,amount';
const REAL_FIELDS = 'hq_type_code,trade_status,prod_name,prod_code,data_timestamp,last_px,px_change,px_change_rate,preclose_px,open_px,high_px,low_px,amplitude,vol_ratio,turnover_ratio,business_amount,business_balance,market_date,up_px,down_px';

export interface KLine {
  day: string;     // '2026-10-23' 或 '2026-10-23 14:30'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RealQuote {
  name: string;
  last: number;
  change: number;
  changeRate: number;
  open: number;
  high: number;
  low: number;
  preclose: number;
}

/** 'sh000001' / '600519' / '00700' / 'AAPL' → 标准化 symbol（sh/sz/bj/hk/us 前缀） */
export function toSymbol(code: string): string {
  const s = (code || '').trim().toLowerCase();
  if (/^(sh|sz|bj)\d{6}$/.test(s)) return s;
  if (/^hk\d{5}$/.test(s)) return s;
  if (/^us[a-z]{1,6}(\.[a-z]{1,2})?$/.test(s)) return s;
  if (/^\d{6}$/.test(s)) {
    const head = s[0];
    if (head === '6' || head === '9') return 'sh' + s;   // 沪主板/科创板(688)
    if (head === '4' || head === '8') return 'bj' + s;    // 北交所
    return 'sz' + s;                                      // 深主板/创业板(30)
  }
  if (/^\d{5}$/.test(s)) return 'hk' + s;                 // 港股 5 位数字
  if (/^\d{1,5}$/.test(s)) return 'sh' + s.padStart(6, '0');
  if (/^[a-z]{1,6}$/.test(s)) return 'us' + s.toUpperCase(); // 美股代码（无后缀，实时时再补）
  return s;
}

/** 市场归属：a=沪深北(cnfin) / hk=港股 / us=美股（后两者走腾讯源） */
export function getMarket(symbol: string): 'a' | 'hk' | 'us' {
  const s = toSymbol(symbol);
  if (s.startsWith('hk')) return 'hk';
  if (s.startsWith('us')) return 'us';
  return 'a';
}

/** symbol → cnfin prod_code（'sh000001' → '000001.SH'） */
export function toProd(symbol: string): string {
  if (/^(sh|sz|bj)\d{6}$/.test(symbol)) return symbol.slice(2) + '.' + symbol.slice(0, 2).toUpperCase();
  return symbol;
}

function fmtTime(t: number | string): string {
  const s = String(t);
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (s.length >= 12) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
  return s;
}

function get<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(`HTTP ${r.status}`)))))
      .then(resolve)
      .catch(reject);
    // #endif
    // #ifndef H5
    uni.request({
      url,
      method: 'GET',
      header: { Referer: 'https://www.cnfin.com/' },
      success: (res: any) => (res.statusCode === 200 ? resolve(res.data as T) : reject(new Error(`HTTP ${res.statusCode}`))),
      fail: (err: any) => reject(new Error(err.errMsg || 'network error')),
    });
    // #endif
  });
}

/** 拉取K线：A股分钟走 cnfin（不支持复权），其余（A股日/周/月 + 港美股全部）走东财（全历史+复权参数） */
export async function fetchKline(code: string, period: Period, count = 1440, fq: 0 | 1 | 2 = 0): Promise<KLine[]> {
  const symbol = toSymbol(code);
  const market = getMarket(symbol);
  const isMinute = period.startsWith('min');
  if (market !== 'a' || !isMinute) {
    const tencent = await import('./tencent');
    return tencent.fetchKlineEastmoney(symbol, period, market === 'a' ? 3000 : 1200, fq);
  }
  const prod = toProd(symbol);
  const url =
    `${CNFIN}/kline?localDate=${Date.now()}&get_type=offset&prod_code=${prod}` +
    `&candle_period=${CANDLE_PERIOD[period]}&candle_mode=1&fields=${encodeURIComponent(KLINE_FIELDS)}&data_count=${count}`;
  return get<any>(url).then((j) => {
    const candle = j?.data?.candle;
    const fields: string[] = candle?.fields || [];
    const rows: any[][] = candle?.[prod] || [];
    const idx: Record<string, number> = {};
    fields.forEach((f, i) => (idx[f] = i));
    if (idx['min_time'] === undefined) throw new Error('行情返回异常');
    return rows.map((row) => ({
      day: fmtTime(row[idx['min_time']]),
      open: row[idx['open_px']],
      high: row[idx['high_px']],
      low: row[idx['low_px']],
      close: row[idx['close_px']],
      volume: row[idx['business_amount']] || 0,
    }));
  });
}

/** 实时快照（A股→cnfin；港股/美股→东财 push2，双端通用） */
export async function fetchReal(code: string): Promise<RealQuote> {
  const symbol = toSymbol(code);
  const market = getMarket(symbol);
  if (market !== 'a') {
    const tencent = await import('./tencent');
    return tencent.fetchRealEastmoney(symbol);
  }
  const prod = toProd(symbol);
  const url = `${CNFIN}/real?en_prod_code=${prod}&fields=${encodeURIComponent(REAL_FIELDS)}`;
  return get<any>(url).then((j) => {
    const snap = j?.data?.snapshot;
    const fields: string[] = snap?.fields || [];
    const rows: any[] = snap?.[prod] || [];
    const d: Record<string, any> = {};
    fields.forEach((f, i) => (d[f] = rows[i]));
    const num = (v: any): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      name: d['prod_name'] || symbol,
      last: num(d['last_px']),
      change: Math.round(num(d['px_change']) * 100) / 100,
      changeRate: Math.round(num(d['px_change_rate']) * 100) / 100,
      open: num(d['open_px']),
      high: num(d['high_px']),
      low: num(d['low_px']),
      preclose: num(d['preclose_px']),
    };
  });
}
