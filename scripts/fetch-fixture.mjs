/** 拉取测试夹具：上证指数日K（约6年） */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'tests', 'fixtures');
mkdirSync(OUT_DIR, { recursive: true });

const FIELDS = 'open_px,high_px,low_px,close_px,business_amount,business_balance,turnover_ratio,preclose_px,special_close_px,settlement,amount';
const url =
  'https://quotedata.cnfin.com/quote/v1/kline' +
  `?localDate=${Date.now()}&get_type=offset&prod_code=000001.SH&candle_period=6&candle_mode=1` +
  `&fields=${encodeURIComponent(FIELDS)}&data_count=1500`;

const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.cnfin.com/' } });
const j = await r.json();
const candle = j?.data?.candle;
const fields = candle?.fields || [];
const rows = candle?.['000001.SH'] || [];
const idx = {};
fields.forEach((f, i) => (idx[f] = i));
const klines = rows.map((row) => {
  const t = String(row[idx['min_time']]);
  return {
    day: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`,
    open: row[idx['open_px']],
    high: row[idx['high_px']],
    low: row[idx['low_px']],
    close: row[idx['close_px']],
    volume: row[idx['business_amount']] || 0,
  };
});
writeFileSync(join(OUT_DIR, 'sh000001-day.json'), JSON.stringify(klines));
console.log('saved', klines.length, 'bars,', klines[0].day, '→', klines[klines.length - 1].day);
