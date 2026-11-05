<template>
  <view class="page">
    <!-- 顶部导语 -->
    <view class="hero">
      <text class="hero-title">缠论核心知识</text>
      <text class="hero-sub">缠中说禅 · 技术分析理论精要 · 供学习研究</text>
    </view>

    <!-- 知识点卡片（可折叠） -->
    <view v-for="(sec, i) in sections" :key="i" class="card">
      <view class="card-head" @click="toggle(i)">
        <text class="card-idx">{{ i + 1 }}</text>
        <text class="card-title">{{ sec.title }}</text>
        <text class="card-arrow" :class="{ open: sec.open }">▾</text>
      </view>
      <view v-if="sec.open" class="card-body">
        <text class="p">{{ sec.summary }}</text>
        <view v-for="(pt, j) in sec.points" :key="j" class="pt">
          <text class="pt-dot">•</text>
          <text class="pt-text">{{ pt }}</text>
        </view>
        <view v-if="sec.tip" class="tip">
          <text class="tip-text">{{ sec.tip }}</text>
        </view>
      </view>
    </view>

    <!-- 买卖点速查表 -->
    <view class="card">
      <view class="card-head" @click="markerOpen = !markerOpen">
        <text class="card-idx">★</text>
        <text class="card-title">买卖点速查表</text>
        <text class="card-arrow" :class="{ open: markerOpen }">▾</text>
      </view>
      <view v-if="markerOpen" class="card-body">
        <view v-for="(row, j) in quickRows" :key="j" class="mk-row">
          <text class="mk-tag" :class="row.cls">{{ row.tag }}</text>
          <view class="mk-main">
            <text class="mk-name">{{ row.name }}</text>
            <text class="mk-desc">{{ row.brief }}</text>
          </view>
        </view>
        <view class="tip">
          <text class="tip-text">红色标记 = 买点，绿色标记 = 卖点。下方六张详解卡写明了每一类的完整判定流程。</text>
        </view>
      </view>
    </view>

    <!-- 六大买卖点详解（可折叠） -->
    <view v-for="(mk, i) in markerSections" :key="'mk' + i" class="card">
      <view class="card-head" @click="toggleMk(i)">
        <text class="card-idx" :class="mk.cls === 'mk-b' ? 'idx-b' : 'idx-s'">{{ mk.tag }}</text>
        <text class="card-title">{{ mk.name }}</text>
        <text class="card-arrow" :class="{ open: mk.open }">▾</text>
      </view>
      <view v-if="mk.open" class="card-body">
        <view v-for="(blk, j) in mk.blocks" :key="j" class="blk">
          <text class="blk-label" :class="blk.kind">{{ blk.label }}</text>
          <view v-for="(line, k) in blk.lines" :key="k" class="pt">
            <text class="pt-dot">{{ blk.kind === 'cond' ? '✓' : blk.kind === 'risk' ? '✗' : '•' }}</text>
            <text class="pt-text">{{ line }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 缠论测试：统计 + 入口 -->
    <view class="card">
      <view class="card-head">
        <text class="card-idx">✎</text>
        <view class="stat-col">
          <text class="card-title">缠论测试</text>
          <text class="stat-sub">边学边测，检验薄弱环节</text>
        </view>
      </view>
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-num">{{ quizStats.answered }}</text>
          <text class="stat-label">已答题</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ quizRate }}%</text>
          <text class="stat-label">正确率</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ quizStats.tests }}</text>
          <text class="stat-label">测试次数</text>
        </view>
      </view>
      <view
        v-for="(s, j) in quizSets"
        :key="j"
        class="quiz-set"
        @click="startQuiz(s.key)"
      >
        <view class="quiz-set-main">
          <text class="quiz-set-name">{{ s.name }}</text>
          <text class="quiz-set-meta">{{ s.count }}题 · {{ s.level }}</text>
        </view>
        <text class="quiz-set-go">开始 ›</text>
      </view>
    </view>

    <view class="footer">仅供学习研究，不构成任何投资建议。</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';

interface Section {
  title: string;
  summary: string;
  points: string[];
  tip?: string;
  open?: boolean;
}

const sections = ref<Section[]>([
  {
    title: '包含关系与K线合并',
    summary: '一切结构分析的前提：相邻两根K线存在包含关系（一根的高低点完全包住另一根）时必须合并，否则分型无从谈起。',
    points: [
      '向上处理：合并后取两根K线的高点较高者与低点较高者',
      '向下处理：合并后取两根K线的低点最低者与高点较低者',
      '方向由前一组合并后的K线趋势决定',
      '本工具自动完成合并，合并后才能识别分型',
    ],
  },
  {
    title: '分型：最小分析单元',
    summary: '合并后的K线中，中间一根高点最高为顶分型，低点最低为底分型。所有更高级别的结构都由分型生长而来。',
    points: [
      '顶分型：第二根K线高点高于左右两根',
      '底分型：第二根K线低点低于左右两根',
      '分型之后不一定成笔，但笔的端点必然是分型',
    ],
  },
  {
    title: '笔：顶底分型的连接',
    summary: '相邻的顶分型与底分型之间的连线构成一笔，顶底必须交替出现。',
    points: [
      '严笔（严格）：顶底分型之间（含两端）至少 5 根合并K线，且顶底分型不共用K线',
      '宽笔（宽松）：顶底分型之间至少 4 根合并K线即可',
      '同性质分型连续出现时，保留更极端者（顶取最高、底取最低）',
      '对应本工具「设置→缠论-笔规则设置」中的笔模式',
    ],
  },
  {
    title: '线段：笔的组合',
    summary: '至少三笔构成一个线段。线段的终结需要用「特征序列」的分型来判定，被笔破坏才宣告结束。',
    points: [
      '特征序列：与线段同向的笔序列',
      '特征序列出现分型（尤其缺口形态）意味着线段可能终结',
      '线段至少包含三笔、且前两笔必须有重叠',
      '对应本工具的「线段」开关与"最小组件=段"模式',
    ],
  },
  {
    title: '中枢：多空争夺的区间',
    summary: '至少三个连续次级别走势的重叠区间构成中枢，是多空反复争夺的成本区域，也是后续所有买卖点的参照物。',
    points: [
      'ZG/ZD：中枢震荡区间的上沿与下沿（三段重叠部分）',
      'GG/DD：中枢内最高点与最低点',
      '中枢延伸：次级别离开中枢后又返回，围绕震荡',
      '中枢破坏：某次级别走势离开中枢后回抽不再回到 ZG/ZD 区间',
      '对应图上的矩形框（橙色为笔中枢、灰色为段中枢）',
    ],
  },
  {
    title: '走势类型与趋势',
    summary: '走势分三类：上涨、下跌、盘整。盘整只含一个中枢；趋势含至少两个同向中枢。',
    points: [
      '上涨趋势：至少两个依次抬高的中枢',
      '下跌趋势：至少两个依次降低的中枢',
      '任何走势终将完成——"走势必完美"是缠论第一原理',
      '对应本工具的「走势」开关（中枢中点连线与趋势标注）',
    ],
  },
  {
    title: '背驰：动能衰竭',
    summary: '同向走势中，后一段创出新高（低）但上涨（跌）动能弱于前一段，即为背驰，预示转折。常用 MACD 红绿柱面积与黄白线高度辅助判断。',
    points: [
      '趋势背驰：发生在趋势中，与前一同向段比较，级别大、转折强',
      '盘整背驰：中枢震荡内的段间比较，级别小',
      'MACD 辅助：创新高但红柱面积/黄白线峰值明显缩小 → 顶背驰',
      '本工具用 MACD 动能对比自动检测背驰点',
    ],
    tip: '打开「设置→MACD」副图对照观察背驰更直观。',
  },
  {
    title: '级别与自同构',
    summary: '分型→笔→线段→走势类型逐级递归，任一级别的结构在更高级别自相似重现。分析时先定级别，再谈买卖。',
    points: [
      '常见级别链：1分→5分→30分→日线→周线→月线',
      '本级别的"笔"在次级别眼中是完整的走势',
      '高级别背驰常由低级别区间套逐级确认',
    ],
    tip: '周期切换（日K→30分→5分）就是级别下钻，用于精确定位买点。',
  },
]);

/* ---------------- 买卖点速查表 ---------------- */
const markerOpen = ref(false);
const quickRows = [
  { tag: '一买', cls: 'mk-b', name: '趋势背驰抄底', brief: '创新低 + MACD 绿柱面积明显缩小' },
  { tag: '二买', cls: 'mk-b', name: '回调确认买', brief: '一买后次级别回调不破一买低点' },
  { tag: '三买', cls: 'mk-b', name: '中枢上移追涨', brief: '突破中枢上沿 ZG 后，回抽低点仍 > ZG' },
  { tag: '一卖', cls: 'mk-s', name: '趋势背驰逃顶', brief: '创新高 + MACD 红柱面积明显缩小' },
  { tag: '二卖', cls: 'mk-s', name: '反弹确认卖', brief: '一卖后次级别反弹不破一卖高点' },
  { tag: '三卖', cls: 'mk-s', name: '中枢下移杀跌', brief: '跌破中枢下沿 ZD 后，回抽高点仍 < ZD' },
];

/* ---------------- 六大买卖点详解 ---------------- */
interface Block { label: string; kind: 'def' | 'cond' | 'step' | 'risk' | 'ref'; lines: string[] }
interface MarkerSection { tag: string; cls: string; name: string; blocks: Block[]; open?: boolean }

const markerSections = ref<MarkerSection[]>([
  {
    tag: '一买', cls: 'mk-b', name: '第一类买点（B1）—— 下跌趋势背驰点',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '下跌趋势（至少两个依次降低的中枢）中，最后一段下跌创出整个趋势的新低，但下跌动能较前一段同向下跌明显衰竭——这个"新低 + 动能衰竭"的转折点就是第一类买点。它是最左侧的买点：买在最低区域，风险收益比最高，但也是最难判、最容易错的。',
        ],
      },
      {
        label: '前提条件（缺一不可）', kind: 'cond', lines: [
          '之前存在标准下跌趋势：打开「线段」+「中枢」开关，能看到至少两个依次下移的中枢矩形',
          '当前下跌段创新低：本段低点低于前一同向下跌段低点',
          '动能衰竭：本段 MACD 绿柱总面积明显小于前一段（萎缩越显著越可靠），DIF 低点抬高（价格新低而指标不新低）',
          '注意：只是"新低"而动能未衰竭不是背驰；只是"动能弱"而未创新低也不构成一买',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：切到本级周期（如日K），打开 笔 / 中枢 / 走势 三个开关，确认至少两个下移中枢',
          '第2步：打开「设置→MACD」副图',
          '第3步：找到最后一笔下跌的端点，与前一同向下跌笔比较：价格是否创新低、绿柱面积是否明显缩小',
          '第4步：满足条件处图上会自动标出红色"一买"三角；顶部信息栏可逐笔核对 MACD',
          '第5步：切次级别（30分→5分）观察底背驰，用区间套精确定位入场点',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '次级别出现同向背驰（区间套确认）',
          '一买后第一笔反弹放量有力（长阳/跳空）',
          '一买前出现加速赶底（跌势末段斜率变陡后骤停）',
          '大级别（周线）处于支撑区域或本身临近背驰',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '一买后横盘不涨、随后再下探是常态——一买极少一蹴而就，往往需要二买确认',
          '若下一笔下跌直接跌破一买那笔的最低点 → 背驰判定失败，趋势延续，必须离场',
          '止损参考：一买当笔的最低点（跌破即错）',
        ],
      },
    ],
  },
  {
    tag: '二买', cls: 'mk-b', name: '第二类买点（B2）—— 回调不创新低',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '第一类买点出现后，价格次级别上涨，随后次级别回调——若回调低点不再创新低（高于一买低点），说明下跌动能确认衰竭、多头开始接管，这个回调低点就是第二类买点。确定性显著高于一买，是实战中"抄底确认"的主力信号。',
        ],
      },
      {
        label: '结构形成过程', kind: 'step', lines: [
          '一买（创新低+背驰）→ 反弹笔（次级别上涨）→ 回调笔（次级别下跌，不破一买低点）→ 二买成立',
          '关键观察：回调笔相对反弹笔是否缩量、是否以横盘代跌（强势整理最可靠）',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：先定位红色"一买"标记（没有一买就没有二买）',
          '第2步：观察一买之后的第二根底分型端点：价格是否高于一买点',
          '第3步：本工具自动判定——一买后隔一笔的底分型端点价格 > 一买价格，即自动标出"二买"',
          '第4步：用顶部信息栏核对回调笔的量能是否萎缩',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '回调笔缩量（量能明显低于反弹笔）',
          '回调低点仍在中枢上方或中枢上沿 ZG 附近获得支撑（更强形态）',
          '回调以横盘代替下跌（时间换空间）',
          '次级别回调本身以盘整背驰结束',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '回调跌破一买低点 → 一买的背驰判定失败，二买自然不成立',
          '止损参考：一买低点（与一买同一止损位，天然小止损）',
        ],
      },
    ],
  },
  {
    tag: '三买', cls: 'mk-b', name: '第三类买点（B3）—— 回抽不回中枢',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '价格向上突破中枢上沿 ZG 之后，次级别回抽的低点不回到中枢区间（回抽低点 > ZG）——说明中枢已完成使命、成本区整体上移，新的上涨阶段展开。三类买点中"趋势跟随"属性最强，常出现在主升浪起点。',
        ],
      },
      {
        label: '结构形成过程', kind: 'step', lines: [
          '中枢震荡 → 某笔放量向上突破 ZG（离开段）→ 次级别回抽 → 回抽低点 > ZG → 三买成立',
          '三买之后中枢必然上移（新中枢在旧中枢上方），上涨趋势就此确立',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：打开「中枢」开关，找到一个清晰的矩形中枢，记住其上沿 ZG（框的顶部）',
          '第2步：观察向上突破 ZG 的那笔是否有力（放量长阳最佳）',
          '第3步：看突破后的回抽笔低点：只要仍高于 ZG，图上即自动标出红色"三买"',
          '第4步：回抽时用顶部信息栏核对量能（缩量回抽为健康形态）',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '离开中枢的笔放量有力、干净利落（不拖泥带水）',
          '回抽缩量、以小阴线/十字星在 ZG 上方企稳',
          '回抽不进中枢且不破离开段的中点（强回抽弱回抽之分）',
          '更大级别（周线）同样处于中枢上方或趋势向上',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '回抽跌回中枢区间内（低于 ZG）→ 三买失效，行情可能转为中枢延伸（继续震荡）',
          '在宽阔的震荡市中，三买信号会反复失败——先看大级别方向，再用小级别三买',
          '止损参考：中枢上沿 ZG（跌回中枢即离场），或回抽笔的低点',
        ],
      },
    ],
  },
  {
    tag: '一卖', cls: 'mk-s', name: '第一类卖点（S1）—— 上涨趋势背驰点',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '上涨趋势（至少两个依次抬高的中枢）中，最后一段上涨创出整个趋势的新高，但上涨动能较前一段同向上涨明显衰竭——"新高 + 动能衰竭"的转折点即第一类卖点。与一买完全对称，是最左侧的卖点。',
        ],
      },
      {
        label: '前提条件（缺一不可）', kind: 'cond', lines: [
          '之前存在标准上涨趋势：至少两个依次上移的中枢矩形',
          '当前上涨段创新高：本段高点高于前一同向上涨段高点',
          '动能衰竭：本段 MACD 红柱总面积明显小于前一段，DIF 峰值降低（价格新高而指标不新高）',
          '顶背驰时若伴随高位放量滞涨/长上影，可靠性加分',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：确认两个及以上依次抬高的中枢（线段+中枢开关）',
          '第2步：打开 MACD 副图，比较最后一段上涨与前一同向上涨段的红柱面积',
          '第3步：价格创新高而红柱面积明显缩小 → 绿色"一卖"三角自动标注',
          '第4步：切次级别（30分→5分）确认顶背驰，区间套精确定位离场点',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '次级别出现同向顶背驰（区间套）',
          '一卖后第一笔下跌放量有力',
          '高位出现放量长上影/乌云盖顶等反转K线组合',
          '上涨末段出现加速赶顶（斜率变陡后骤停）',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '一卖后横盘、随后再创新高是常见陷阱——强势股一卖后常有二次冲顶',
          '若下一笔上涨突破一卖那笔的最高点 → 背驰失败，趋势延续，切勿逆势加空/清仓后追高',
          '离场参考：一卖当笔的最高点被突破即认定失效',
        ],
      },
    ],
  },
  {
    tag: '二卖', cls: 'mk-s', name: '第二类卖点（S2）—— 反弹不创新高',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '第一类卖点出现后，价格次级别下跌，随后次级别反弹——若反弹高点不再创新高（低于一卖高点），说明上涨动能确认衰竭、空头接管，这个反弹高点就是第二类卖点。逃顶的"确认信号"。',
        ],
      },
      {
        label: '结构形成过程', kind: 'step', lines: [
          '一卖（新高+背驰）→ 下跌笔（次级别下跌）→ 反弹笔（次级别上涨，不破一卖高点）→ 二卖成立',
          '反弹越弱（缩量、小阳、横盘）→ 二卖越可靠',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：先定位绿色"一卖"标记',
          '第2步：观察一卖之后第二根顶分型端点：价格是否低于一卖点',
          '第3步：本工具自动判定——一卖后隔一笔的顶分型端点价格 < 一卖价格，自动标出"二卖"',
          '第4步：核对反弹笔量能是否萎缩（缩量反弹=虚弱）',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '反弹笔缩量（低于下跌笔量能）',
          '反弹高点仍在中枢下方或中枢下沿 ZD 附近承压（更弱形态）',
          '反弹以横盘代替上涨（弱势整理）',
          '次级别反弹本身以盘整背驰结束',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '反弹突破一卖高点 → 一卖背驰判定失败，二卖不成立',
          '失效参考：一卖当笔的最高点（突破即认定趋势延续）',
        ],
      },
    ],
  },
  {
    tag: '三卖', cls: 'mk-s', name: '第三类卖点（S3）—— 回抽不回中枢',
    blocks: [
      {
        label: '定义', kind: 'def', lines: [
          '价格向下跌破中枢下沿 ZD 之后，次级别回抽的高点不回到中枢区间（回抽高点 < ZD）——中枢整体下移确认，新的下跌阶段展开。与三买完全对称，常出现在主跌浪起点。',
        ],
      },
      {
        label: '结构形成过程', kind: 'step', lines: [
          '中枢震荡 → 某笔放量向下跌破 ZD（离开段）→ 次级别回抽 → 回抽高点 < ZD → 三卖成立',
          '三卖之后中枢必然下移（新中枢在旧中枢下方），下跌趋势就此确立',
        ],
      },
      {
        label: '图上识别步骤（用本工具）', kind: 'step', lines: [
          '第1步：打开「中枢」开关，找到清晰的矩形中枢，记住其下沿 ZD（框的底部）',
          '第2步：观察向下跌破 ZD 的那笔（放量长阴最佳）',
          '第3步：看跌破后的回抽笔高点：只要仍低于 ZD，图上即自动标出绿色"三卖"',
          '第4步：回抽时核对量能——缩量弱反弹是最健康的下跌形态',
        ],
      },
      {
        label: '确认加固（越多越可靠）', kind: 'cond', lines: [
          '离开中枢的下跌笔放量有力',
          '回抽缩量、以小阳线/十字星在 ZD 下方承压',
          '回抽不进中枢且不破离开段的中点',
          '更大级别同样处于中枢下方或趋势向下',
        ],
      },
      {
        label: '失效与止损', kind: 'risk', lines: [
          '回抽涨回中枢区间内（高于 ZD）→ 三卖失效，行情可能转为中枢延伸',
          '宽幅震荡市中三卖信号反复失败——先定大级别方向再用小级别三卖',
          '失效参考：中枢下沿 ZD（涨回中枢即认定失败）',
        ],
      },
    ],
  },
]);

function toggle(i: number) {
  sections.value[i].open = !sections.value[i].open;
}
function toggleMk(i: number) {
  markerSections.value[i].open = !markerSections.value[i].open;
}

/* ---------------- 缠论测试 ---------------- */
const quizSets = [
  { key: 'zs', name: '中枢判断基础测试', count: 10, level: '入门级' },
  { key: 'mm', name: '买卖点识别测试', count: 10, level: '进阶级' },
  { key: 'bc', name: '背驰判断进阶测试', count: 10, level: '高级' },
];
const STAT_KEY = 'CL_QUIZ_STATS';
const quizStats = ref({ answered: 0, correct: 0, tests: 0 });
const quizRate = computed(() => {
  const s = quizStats.value;
  return s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
});
function loadStats() {
  try {
    const s = uni.getStorageSync(STAT_KEY);
    if (s) quizStats.value = s as any;
  } catch { /* ignore */ }
}
function startQuiz(key: string) {
  uni.navigateTo({ url: `/pages/learn/quiz?set=${key}` });
}
onShow(loadStats);
</script>

<style scoped>
.page {
  min-height: 100vh;
  min-height: 100dvh;
  background-color: #f5f6fa;
  /* 底部留出 tabBar 高度，最下面的文字不再被导航栏挡住 */
  padding: 10px 10px 80px;
}
/* 导语 */
.hero {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-title { color: #fff; font-size: 20px; font-weight: 700; }
.hero-sub { color: rgba(255, 255, 255, 0.85); font-size: 12px; }

/* 卡片 */
.card {
  background: #fff;
  border-radius: 8px;
  margin-top: 10px;
  overflow: hidden;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 13px 14px;
}
.card-idx {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 11px;
  background: #e6f4ff;
  color: #1890ff;
  font-size: 12px;
  font-weight: 600;
  margin-right: 10px;
  flex-shrink: 0;
}
.card-idx.idx-b { background: #fdecea; color: #ec0000; }
.card-idx.idx-s { background: #e6f7ef; color: #00a854; }
.card-title { flex: 1; font-size: 15px; font-weight: 600; color: #212529; }
.card-arrow { color: #adb5bd; font-size: 13px; transition: transform 0.2s; }
.card-arrow.open { transform: rotate(180deg); }
.card-body {
  padding: 2px 14px 12px 46px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.p { font-size: 13px; color: #495057; line-height: 1.6; }
.pt { display: flex; flex-direction: row; margin-top: 2px; }
.pt-dot { color: #1890ff; font-size: 12px; margin-right: 6px; flex-shrink: 0; }
.pt-text { flex: 1; font-size: 12px; color: #6c757d; line-height: 1.6; }
.tip {
  margin-top: 6px;
  background: #fff8e1;
  border-radius: 6px;
  padding: 8px 10px;
}
.tip-text { color: #e65100; font-size: 11px; line-height: 1.5; }

/* 买卖点速查 */
.mk-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin-top: 8px;
}
.mk-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 10px;
  flex-shrink: 0;
}
.mk-b { background: #fdecea; color: #ec0000; }
.mk-s { background: #e6f7ef; color: #00a854; }
.mk-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.mk-name { font-size: 13px; font-weight: 600; color: #212529; }
.mk-desc { font-size: 12px; color: #6c757d; line-height: 1.5; }

/* 测试统计与入口 */
.stat-col { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.stat-sub { font-size: 11px; color: #adb5bd; }
.stats-row {
  display: flex;
  flex-direction: row;
  padding: 4px 14px 10px;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-num { font-size: 20px; font-weight: 700; color: #1890ff; }
.stat-label { font-size: 11px; color: #999; }
.quiz-set {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-top: 1px solid #f2f3f5;
}
.quiz-set:active { background: #f8f9fa; }
.quiz-set-main { display: flex; flex-direction: column; gap: 2px; }
.quiz-set-name { font-size: 14px; font-weight: 500; color: #212529; }
.quiz-set-meta { font-size: 11px; color: #999; }
.quiz-set-go { font-size: 13px; color: #1890ff; }

/* 详解块 */
.blk { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.blk-label {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
}
.blk-label.def { background: #e6f4ff; color: #1890ff; }
.blk-label.cond { background: #e6f7ef; color: #00a854; }
.blk-label.step { background: #f0f2f5; color: #495057; }
.blk-label.risk { background: #fdecea; color: #ec0000; }
.blk .pt-dot { color: #adb5bd; }
.blk .pt-text { color: #495057; }
.blk .pt-dot:only-child { color: #adb5bd; }

.footer {
  text-align: center;
  color: #adb5bd;
  font-size: 11px;
  padding: 16px 0 4px;
}
</style>
