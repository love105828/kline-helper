/** 内置标的列表：指数 + 常用A股/港股/美股（离线兜底，联网时优先腾讯全市场联想） */
export interface StockItem {
  code: string;        // sh000001 / hk00700 / usAAPL.OQ
  name: string;
  market: 'sh' | 'sz' | 'hk' | 'us';
  tag: string;         // 沪/深/科创/创业/港/美/指
}

export const INDEX_LIST: StockItem[] = [
  { code: 'sh000001', name: '上证指数', market: 'sh', tag: '指' },
  { code: 'sz399001', name: '深证成指', market: 'sz', tag: '指' },
  { code: 'sz399006', name: '创业板指', market: 'sz', tag: '指' },
  { code: 'sh000688', name: '科创50', market: 'sh', tag: '指' },
  { code: 'sh000300', name: '沪深300', market: 'sh', tag: '指' },
  { code: 'sh000905', name: '中证500', market: 'sh', tag: '指' },
  { code: 'sh000852', name: '中证1000', market: 'sh', tag: '指' },
  { code: 'sh000016', name: '上证50', market: 'sh', tag: '指' },
];

export const STOCK_LIST: StockItem[] = [
  // A股 - 沪主板 / 科创板
  { code: 'sh600519', name: '贵州茅台', market: 'sh', tag: '沪' },
  { code: 'sh601318', name: '中国平安', market: 'sh', tag: '沪' },
  { code: 'sh600036', name: '招商银行', market: 'sh', tag: '沪' },
  { code: 'sh601988', name: '中国银行', market: 'sh', tag: '沪' },
  { code: 'sh601398', name: '工商银行', market: 'sh', tag: '沪' },
  { code: 'sh600028', name: '中国石化', market: 'sh', tag: '沪' },
  { code: 'sh601857', name: '中国石油', market: 'sh', tag: '沪' },
  { code: 'sh600900', name: '长江电力', market: 'sh', tag: '沪' },
  { code: 'sh601899', name: '紫金矿业', market: 'sh', tag: '沪' },
  { code: 'sh600030', name: '中信证券', market: 'sh', tag: '沪' },
  { code: 'sh600104', name: '上汽集团', market: 'sh', tag: '沪' },
  { code: 'sh601012', name: '隆基绿能', market: 'sh', tag: '沪' },
  { code: 'sh600089', name: '特变电工', market: 'sh', tag: '沪' },
  { code: 'sh688981', name: '中芯国际', market: 'sh', tag: '科创' },
  { code: 'sh688111', name: '金山办公', market: 'sh', tag: '科创' },
  { code: 'sh688787', name: '海天瑞声', market: 'sh', tag: '科创' },
  { code: 'sh688012', name: '中微公司', market: 'sh', tag: '科创' },
  { code: 'sh688256', name: '寒武纪', market: 'sh', tag: '科创' },
  // A股 - 深主板 / 创业板
  { code: 'sz000858', name: '五粮液', market: 'sz', tag: '深' },
  { code: 'sz000333', name: '美的集团', market: 'sz', tag: '深' },
  { code: 'sz000651', name: '格力电器', market: 'sz', tag: '深' },
  { code: 'sz000002', name: '万科A', market: 'sz', tag: '深' },
  { code: 'sz002594', name: '比亚迪', market: 'sz', tag: '深' },
  { code: 'sz002460', name: '赣锋锂业', market: 'sz', tag: '深' },
  { code: 'sz002074', name: '国轩高科', market: 'sz', tag: '深' },
  { code: 'sz002230', name: '科大讯飞', market: 'sz', tag: '深' },
  { code: 'sz002352', name: '顺丰控股', market: 'sz', tag: '深' },
  { code: 'sz002371', name: '北方华创', market: 'sz', tag: '深' },
  { code: 'sz300750', name: '宁德时代', market: 'sz', tag: '创业' },
  { code: 'sz300059', name: '东方财富', market: 'sz', tag: '创业' },
  { code: 'sz300124', name: '汇川技术', market: 'sz', tag: '创业' },
  { code: 'sz300760', name: '迈瑞医疗', market: 'sz', tag: '创业' },
  // 港股
  { code: 'hk00700', name: '腾讯控股', market: 'hk', tag: '港' },
  { code: 'hk09988', name: '阿里巴巴-W', market: 'hk', tag: '港' },
  { code: 'hk03690', name: '美团-W', market: 'hk', tag: '港' },
  { code: 'hk01810', name: '小米集团-W', market: 'hk', tag: '港' },
  { code: 'hk09618', name: '京东集团-SW', market: 'hk', tag: '港' },
  { code: 'hk09888', name: '百度集团-SW', market: 'hk', tag: '港' },
  { code: 'hk01024', name: '快手-W', market: 'hk', tag: '港' },
  { code: 'hk00388', name: '香港交易所', market: 'hk', tag: '港' },
  { code: 'hk00941', name: '中国移动', market: 'hk', tag: '港' },
  { code: 'hk02318', name: '中国平安(HK)', market: 'hk', tag: '港' },
  { code: 'hk01299', name: '友邦保险', market: 'hk', tag: '港' },
  { code: 'hk00857', name: '中国石油股份', market: 'hk', tag: '港' },
  { code: 'hk01211', name: '比亚迪股份', market: 'hk', tag: '港' },
  { code: 'hk06098', name: '碧桂园服务', market: 'hk', tag: '港' },
  { code: 'hk06618', name: '京东健康', market: 'hk', tag: '港' },
  // 美股
  { code: 'usAAPL.OQ', name: '苹果', market: 'us', tag: '美' },
  { code: 'usMSFT.OQ', name: '微软', market: 'us', tag: '美' },
  { code: 'usNVDA.OQ', name: '英伟达', market: 'us', tag: '美' },
  { code: 'usTSLA.OQ', name: '特斯拉', market: 'us', tag: '美' },
  { code: 'usGOOGL.OQ', name: '谷歌-A', market: 'us', tag: '美' },
  { code: 'usAMZN.OQ', name: '亚马逊', market: 'us', tag: '美' },
  { code: 'usMETA.OQ', name: 'Meta', market: 'us', tag: '美' },
  { code: 'usBRK-B.N', name: '伯克希尔-B', market: 'us', tag: '美' },
  { code: 'usAMD.OQ', name: 'AMD', market: 'us', tag: '美' },
  { code: 'usINTC.OQ', name: '英特尔', market: 'us', tag: '美' },
  { code: 'usBABA.N', name: '阿里巴巴', market: 'us', tag: '美' },
  { code: 'usPDD.OQ', name: '拼多多', market: 'us', tag: '美' },
  { code: 'usJD.OQ', name: '京东', market: 'us', tag: '美' },
  { code: 'usBIDU.OQ', name: '百度', market: 'us', tag: '美' },
  { code: 'usNFLX.OQ', name: '奈飞', market: 'us', tag: '美' },
];

/** 本地匹配：代码数字/字母 或 名称（离线兜底） */
export function searchStocks(key: string, limit = 10): StockItem[] {
  const k = (key || '').trim().toLowerCase();
  if (!k) return [];
  const all = [...INDEX_LIST, ...STOCK_LIST];
  const codeHit = all.filter((s) => s.code.toLowerCase().includes(k));
  const nameHit = all.filter((s) => s.name.includes(key.trim()) && !codeHit.includes(s));
  return [...codeHit, ...nameHit].slice(0, limit);
}
