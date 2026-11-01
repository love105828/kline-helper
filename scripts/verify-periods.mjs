/** 验证 cnfin candle_period 与周期的映射：观察各 period 的K线日期间隔 */
const CNFIN = 'https://quotedata.cnfin.com/quote/v1/kline';
const FIELDS = 'open_px,high_px,low_px,close_px,business_amount,business_balance,turnover_ratio,preclose_px,special_close_px,settlement,amount';

for (const cp of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const url = `${CNFIN}?localDate=${Date.now()}&get_type=offset&prod_code=000001.SH&candle_period=${cp}&candle_mode=1&fields=${encodeURIComponent(FIELDS)}&data_count=8`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.cnfin.com/' } });
    const j = await r.json();
    const candle = j?.data?.candle;
    const rows = candle?.['000001.SH'] || [];
    const times = rows.map(row => String(row[0]));
    console.log(`period=${cp}  count=${rows.length}  first=${times[0]}  last=${times[times.length - 1]}  sample=${times.slice(0, 4).join(' | ')}`);
  } catch (e) {
    console.log(`period=${cp}  ERROR ${e.message}`);
  }
}
