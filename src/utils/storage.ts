/** 本地收藏与偏好设置（uni storage，H5 落 localStorage） */
import type { Period } from '../api/cnfin';

export interface FavItem {
  code: string;   // sh000001
  name: string;
}

export interface Prefs {
  symbol: string;
  name: string;
  period: Period;
  showStroke: boolean;
  showSegment: boolean;
  showPivot: boolean;
  showTrend: boolean;
  showVol: boolean;
  showMacd: boolean;
  showMa: boolean;
  showMarkers: boolean;
  showCursor: boolean;
  /* 缠论参数（对照原站设置面板） */
  biMode: 'strict' | 'loose';      // 严笔(底分型+趋势K+顶分型) / 宽笔(底分型+独立K+顶分型)
  segAlgo: 'simple' | 'fs_strict' | 'fs_optimize'; // 段算法：简化特征序列 / 标准特征序列·严格包含 / 标准特征序列·优化包含
  prefsVersion?: number;
  fq: 0 | 1 | 2;                   // 复权：0=不复权 1=前复权 2=后复权（A股/港股K线生效；美股强制前复权）
  tdxFormula: string;              // 通达信公式（导入叠加）
  gapMerge: boolean;               // 缺口处理：false=不处理 true=视为1根K线
  minComponent: 'duan' | 'bi';     // 最小组件：段(特征序列) / 笔(走势递归)
  zsRange: 'all' | 'first3';       // 中枢区间：所有段延伸 / 前三段
  zsStd: 'endpoint' | 'actual';    // 中枢绘制：起终点ZG/ZD / 实际高低点GG/DD
  noticeClosed: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  symbol: 'sh000001',
  name: '上证指数',
  period: 'day',
  showStroke: true,
  showSegment: true,
  showPivot: true,
  showTrend: false,
  showVol: true,
  showMacd: false,
  showMa: false,
  showMarkers: true,
  showCursor: true,
  biMode: 'strict',
  segAlgo: 'simple',
  prefsVersion: 4,
  fq: 0,
  tdxFormula: '',
  gapMerge: false,
  minComponent: 'duan',
  zsRange: 'all',
  zsStd: 'endpoint',
  noticeClosed: false,
};

const FAV_KEY = 'CL_FAVORITES';
const PREF_KEY = 'CL_PREFS';
const PENDING_KEY = 'CL_PENDING_SYMBOL';

export function getPrefs(): Prefs {
  try {
    const saved = uni.getStorageSync(PREF_KEY) as Partial<Prefs> | '';
    if (!saved) return { ...DEFAULT_PREFS };
    const merged = { ...DEFAULT_PREFS, ...saved } as Prefs;
    // 一次性迁移：段算法默认回退为"简化"，恢复既有买卖点行为（版本 < 2）
    if ((merged.prefsVersion ?? 1) < 4) {
      merged.segAlgo = 'simple';
      merged.showMarkers = true;
      merged.tdxFormula = '';
      merged.prefsVersion = 4;
      try { uni.setStorageSync(PREF_KEY, merged); } catch { /* ignore */ }
    }
    return merged;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
export function setPrefs(p: Partial<Prefs>) {
  try {
    uni.setStorageSync(PREF_KEY, { ...getPrefs(), ...p });
  } catch { /* ignore */ }
}

export function getFavorites(): FavItem[] {
  try {
    return (uni.getStorageSync(FAV_KEY) as FavItem[]) || [];
  } catch {
    return [];
  }
}
export function isFavorite(code: string): boolean {
  return getFavorites().some((f) => f.code === code);
}
export function addFavorite(item: FavItem) {
  const list = getFavorites();
  if (!list.some((f) => f.code === item.code)) {
    list.push(item);
    uni.setStorageSync(FAV_KEY, list);
  }
}
export function removeFavorite(code: string) {
  uni.setStorageSync(FAV_KEY, getFavorites().filter((f) => f.code !== code));
}

/** 收藏页 → 行情页 传参（switchTab 无法带 query） */
export function setPendingSymbol(item: FavItem) {
  uni.setStorageSync(PENDING_KEY, item);
}
export function consumePendingSymbol(): FavItem | null {
  try {
    const p = uni.getStorageSync(PENDING_KEY);
    if (p) uni.removeStorageSync(PENDING_KEY);
    return p || null;
  } catch {
    return null;
  }
}


/* ---------------- AI 服务商与分析历史 ---------------- */
export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;   // 如 https://api.deepseek.com/v1
  apiKey: string;
  model: string;     // 如 deepseek-chat
}

const AI_PROVIDERS_KEY = 'CL_AI_PROVIDERS';
const AI_ACTIVE_KEY = 'CL_AI_ACTIVE';
const AI_HISTORY_KEY = 'CL_AI_HISTORY';

export function getAiProviders(): AiProvider[] {
  try {
    return (uni.getStorageSync(AI_PROVIDERS_KEY) as AiProvider[]) || [];
  } catch {
    return [];
  }
}
export function saveAiProviders(list: AiProvider[]) {
  try { uni.setStorageSync(AI_PROVIDERS_KEY, list); } catch { /* ignore */ }
}
export function getActiveAiProvider(): AiProvider | null {
  const list = getAiProviders();
  const id = uni.getStorageSync(AI_ACTIVE_KEY) as string;
  return list.find((p) => p.id === id) || list[0] || null;
}
export function setActiveAiProvider(id: string) {
  try { uni.setStorageSync(AI_ACTIVE_KEY, id); } catch { /* ignore */ }
}

export interface AiHistoryItem {
  t: number;          // 时间戳
  symbol: string;
  period: string;
  content: string;
}

export function getAiHistory(): AiHistoryItem[] {
  try {
    return (uni.getStorageSync(AI_HISTORY_KEY) as AiHistoryItem[]) || [];
  } catch {
    return [];
  }
}
export function pushAiHistory(item: AiHistoryItem) {
  try {
    const list = getAiHistory();
    list.unshift(item);
    uni.setStorageSync(AI_HISTORY_KEY, list.slice(0, 20));
  } catch { /* ignore */ }
}