/** 按市场区分货币单位：A股/北交所=人民币，港股=港元，美股=美元，指数=点 */
import { toSymbol } from '../api/cnfin';

export interface CurrencyInfo {
  /** 完整单位（报价头用）：元 / 港元 / 美元 / 点 */
  suffix: string;
  /** 短符号（图表Y轴用）：¥ / HK$ / US$ / 点 */
  axis: string;
}

export function getCurrencyInfo(symbol: string): CurrencyInfo {
  const s = toSymbol(symbol);
  // A股指数：sh000xxx / sz399xxx
  if (/^sh000\d{3}$/.test(s) || /^sz399\d{3}$/.test(s)) return { suffix: '点', axis: '点' };
  if (s.startsWith('hk')) {
    // 港股指数：hk 后不是 5 位纯数字（如 hkHSI 恒生指数）
    if (!/^hk\d{5}$/.test(s)) return { suffix: '点', axis: '点' };
    return { suffix: '港元', axis: 'HK$' };
  }
  if (s.startsWith('us')) {
    // 美股指数
    if (/\.(dji|ixic|inx|spx)$/i.test(s)) return { suffix: '点', axis: '点' };
    return { suffix: '美元', axis: 'US$' };
  }
  // sh/sz/bj 股票：人民币
  return { suffix: '元', axis: '¥' };
}
