<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">多元策略</text>
      <text class="hero-sub">投资大师 · 经典书籍 · 国产游资 · 策略精要 · 仅供学习研究</text>
    </view>

    <view class="filter-row">
      <view
        v-for="f in filters"
        :key="f.key"
        class="filter-chip"
        :class="{ on: filter === f.key }"
        @click="filter = f.key"
      >{{ f.name }}</view>
    </view>

    <view v-for="(m, i) in filteredMasters" :key="i" class="card">
      <view class="card-head" @click="toggle(i)">
        <view class="avatar" :class="m.kind === 'book' ? 'av-book' : 'av-person'">{{ m.kind === 'book' ? '书' : m.name.slice(0, 1) }}</view>
        <view class="head-main">
          <text class="m-name">{{ m.name }}</text>
          <text class="m-tag">{{ m.tag }}</text>
        </view>
        <text class="card-arrow" :class="{ open: m.open }">▾</text>
      </view>
      <view v-if="m.open" class="card-body">
        <text class="m-intro">{{ m.intro }}</text>
        <view class="blk">
          <text class="blk-label">核心策略</text>
          <view v-for="(pt, j) in m.points" :key="j" class="pt">
            <text class="pt-dot">•</text>
            <text class="pt-text">{{ pt }}</text>
          </view>
        </view>
        <view v-if="m.quote" class="quote">
          <text class="quote-text">“{{ m.quote }}”</text>
        </view>
      </view>
    </view>

    <view class="footer">内容为公开资料的梗概整理，仅供学习研究，不构成任何投资建议。</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Master {
  name: string;
  tag: string;
  kind: 'person' | 'book';
  intro: string;
  points: string[];
  quote?: string;
  open?: boolean;
}

const categories = ['价值投资', '成长投资', '宏观 · 逆向 · 量化', '交易技术'];

const masters = ref<Master[]>([
  {
    name: '本杰明·格雷厄姆', cat: 'person', tag: '价值投资之父 · 《聪明的投资者》《证券分析》', kind: 'person',
    intro: '价值投资奠基人。经历 1929 年大崩盘后总结出一套以"安全边际"为核心的投资体系，巴菲特称之为"对我影响最大的老师"。',
    points: [
      '安全边际：只在价格显著低于内在价值时买入（如净营运资产 2/3 折价）',
      '市场先生：市场是情绪化的报价者，利用它的错误而非被它牵引',
      '防御型与进取型投资者分层：普通人用指数+股债平衡即可',
      '分散持有、定量筛选（低PE、低PB、财务稳健）',
    ],
    quote: '价格是你付出的，价值是你得到的。',
  },
  {
    name: '沃伦·巴菲特', cat: 'person', tag: '伯克希尔 · 《致股东的信》', kind: 'person',
    intro: '格雷厄姆的学生，融合费雪的质量思想，把价值投资发展为"以合理价格买伟大公司"并长期持有。',
    points: [
      '护城河：品牌、成本、网络效应、转换成本——长期竞争优势是首选标准',
      '能力圈：只投看得懂的生意，看不懂的放弃',
      '把股票当作企业所有权，市场报价只是服务你的工具',
      '别人贪婪我恐惧，别人恐惧我贪婪',
      '时间是好生意的朋友：复利来自长期持有',
    ],
    quote: '用合理的价格买一家优秀的公司，远胜于用便宜的价格买一家平庸的公司。',
  },
  {
    name: '查理·芒格', cat: 'person', tag: '伯克希尔副主席 · 《穷查理宝典》', kind: 'person',
    intro: '巴菲特 50 余年的合伙人，把投资从"数字游戏"提升为"多元思维模型"的理性决策学科。',
    points: [
      '多元思维模型：跨学科（物理、生物、心理、经济）建立决策格栅',
      '逆向思维：反过来想，总是反过来想——先想怎么会失败',
      '质量优先：为好生意付合理价格，胜过为平庸生意付低价',
      '避免愚蠢比追求聪明更重要：建立误判心理学清单',
    ],
    quote: '如果我知道我会死在哪里，我就永远不去那里。',
  },
  {
    name: '彼得·林奇', cat: 'person', tag: '麦哲伦基金 · 《彼得·林奇的成功投资》', kind: 'person',
    intro: '13 年把麦哲伦基金规模做到 27 倍的传奇基金经理，主张"从生活中找牛股"。',
    points: [
      '六类公司分类：缓慢增长、稳定增长、快速增长、周期、困境反转、隐蔽资产——不同类型不同玩法',
      'GARP：以合理价格买成长（PEG≈1 为宜）',
      '身边调研优势：超市、商场里的畅销品往往是牛股来源',
      '翻石头：看的公司越多，找到好公司的概率越大',
      ' understand 波动：下跌是好公司打折的机会',
    ],
    quote: '人们总是高估短期机会，而低估长期的机会。',
  },
  {
    name: '菲利普·费雪（大费雪）', cat: 'person', tag: '成长投资之父 · 《怎样选择成长股》', kind: 'person',
    intro: '成长股投资的开创者，"闲聊法"调研发明人，深刻影响巴菲特"85% 格雷厄姆 + 15% 费雪"的自评。',
    points: [
      '15 要点：寻找有市场潜力、利润率、研发与管理层卓越的成长公司',
      '闲聊法（Scuttlebutt）：走访客户、对手、前员工验证判断',
      '集中持有少数真正优秀的公司，长期陪伴',
      '买入时机不重要，选对公司才重要（激进派观点）',
    ],
    quote: '好的投资标的屈指可数，找到就重仓并长期持有。',
  },
  {
    name: '肯尼斯·费雪（小费雪）', cat: 'person', tag: '费雪投资创始人 · 《超级强势股》', kind: 'person',
    intro: '菲利普·费雪之子，量化成长股筛选的先驱，提出 PSR（市销率）指标。',
    points: [
      'PSR 市销率：市值/销售额 < 0.75 时往往是超级强势股的买点，>3 警惕',
      '成长股生命周期：失败阶段→成长爆发期→成熟期，买在爆发期起点',
      '避开"热门股"，在冷落中寻找基本面反转',
      ' Capitol 周期：研发投入后的产出期是超额收益来源',
    ],
    quote: '超级强势股来自市场的冷落之处，而非聚光灯下。',
  },
  {
    name: '乔治·索罗斯', cat: 'person', tag: '量子基金 · 《金融炼金术》', kind: 'person',
    intro: '宏观对冲大师，1992 年狙击英镑一战成名。"反身性理论"是其哲学核心。',
    points: [
      '反身性：价格不只是反映基本面，还会反过来改变基本面（正反馈循环）',
      '趋势的自我强化与自我毁灭：泡沫走到极端后崩溃，抓住转折点',
      '重要的不是对错，而是"对的时候赚多少，错的时候亏多少"',
      '活下来第一：永远知道自己的风险敞口',
    ],
    quote: '重要的不是你对还是错，而是你对的时候赚了多少，错的时候亏了多少。',
  },
  {
    name: '约翰·邓普顿', cat: 'person', tag: '邓普顿基金 · 《邓普顿教你逆向投资》', kind: 'person',
    intro: '全球逆向投资大师，"极度悲观点"策略创立者， first 到日本、韩国等冷门市场淘金。',
    points: [
      '极度悲观点买入：当所有人都绝望抛售时，价格已充分反映坏消息',
      '全球视野：在被人忽视的市场寻找便宜货',
      '牛市在悲观中诞生，在怀疑中成长，在乐观中成熟，在狂喜中死亡',
      '长期持有：基于基本面而非市场情绪做决策',
    ],
    quote: '行情总在绝望中诞生，在怀疑中成长，在乐观中成熟，在兴奋中死亡。',
  },
  {
    name: '吉姆·西蒙斯', cat: 'person', tag: '文艺复兴科技 · 大奖章基金', kind: 'person',
    intro: '数学家出身的量化之王。大奖章基金 1988-2018 年年化约 66%（费前），是金融史上最成功的量化基金。',
    points: [
      '数据驱动：从海量价格数据中挖掘统计规律，不依赖经济学叙事',
      '高频短线+统计套利：无数微小优势叠加成巨大收益',
      '顶级人才：招数学家/物理学家/信号处理专家而非金融背景',
      '严守保密与纪律：模型说了算，人只做系统允许的事',
    ],
    quote: '我们靠数据与数学赚钱，不靠故事。',
  },
  {
    name: '霍华德·马克斯', cat: 'person', tag: '橡树资本 · 《投资最重要的事》', kind: 'person',
    intro: '不良债权投资巨头，备忘录被巴菲特列为"必读"。以周期思维与风险控制著称。',
    points: [
      '第二层思维：不只问"好不好"，还要问"价格里已经包含了多少乐观"',
      '周期无处不在：钟摆永远在恐惧与贪婪之间摆动',
      '风险不是波动，而是永久损失的概率',
      '你无法预测，但可以准备：判断我们处在周期哪个位置',
    ],
    quote: '我们无法预测未来，但可以评估当下周期的温度。',
  },
  {
    name: '段永平', cat: 'person', tag: '步步高创始人 · 网易/茅台投资人', kind: 'person',
    intro: '中国本土价值投资代表人物。2001 年互联网泡沫破裂时重仓网易获利百倍，后长期持有茅台、苹果。',
    points: [
      '买股票就是买公司：看十年后这家公司会怎样',
      '本分：不做自己不懂的事，不赚认知以外的钱',
      '商业模式 + 企业文化：生意模式好不好、管理层靠不靠谱是全部',
      '忽略市场波动：股票市场是给"傻钱"定价的地方',
      'Stop Doing List：不做空、不用 margin、不做不懂的东西',
    ],
    quote: '买你真正看得懂的好公司，拿住，别的都是噪音。',
  },
  {
    name: '李录', cat: 'person', tag: '喜马拉雅资本 · 《文明、现代化、价值投资与中国》', kind: 'person',
    intro: '查理·芒格的学生与家族资金管理人，把价值投资引入中国的代表人物。',
    points: [
      '价值投资四支柱：股票=公司所有权、市场先生、安全边际、能力圈',
      '能力圈靠长期诚实的积累圈出来，而非划出来',
      '现代化本质：科学技术与自由市场结合产生的复利增长',
      '在中国做价值投资：市场更无效→机会更多，但需更强定力',
    ],
    quote: '知识是慢慢积累起来的，能力圈是一点点诚实圈出来的。',
  },
  {
    name: '《CIS 股票交易术》', cat: 'book', tag: 'CIS 著 · 日本散户交易传奇', kind: 'book',
    intro: '日本最神秘的个人交易者 CIS，从 300 万日元做到数百亿日元，以"突破追涨"短线纪律闻名。',
    points: [
      '突破追涨：创新高/放量突破就买，强者恒强（他称之为"增长支持"）',
      '止损是生命线：跌破关键位立刻斩仓，绝不抗单',
      '落袋为安与再入场：分批止盈，回调到位再接回',
      '逆势抄底要轻仓快跑：只用"小仓位+严格止损"参与',
      '心理：把交易当游戏，用数字而非情绪决策',
    ],
    quote: '跌了就卖，涨了就买——简单的事坚持做。',
  },
  {
    name: '《日本蜡烛图技术》', cat: 'book', tag: '史蒂夫·尼森 著 · K线形态学经典', kind: 'book',
    intro: '把日本蜡烛图（K线）分析系统介绍到西方的开山之作，与缠论同源（都源自日本米市酒田战法）。',
    points: [
      '单根形态：锤子线、上吊线、流星线、十字星——多空转折信号',
      '组合形态：吞没（抱线）、乌云盖顶、刺透、启明星/黄昏星',
      '位置决定意义：同一形态在高点与低点含义相反',
      '必须结合趋势与支撑阻力使用，孤立形态不可靠',
      '与缠论互补：分型的本质就是最小的蜡烛图反转组合',
    ],
    quote: '形态是语言，位置是语境。',
  },
  {
    name: '《祖鲁法则》', cat: 'book', tag: '吉姆·斯莱特 著 · 成长股选股体系', kind: 'book',
    intro: '英国投资大师斯莱特以"祖鲁人以小胜大"为喻，教普通投资者在成长股集中火力、以专胜全。',
    points: [
      '祖鲁原则：不做分散的平庸，集中火力攻小盘成长股（大机构覆盖不到）',
      'PEG 选股法：PEG = 市盈率 ÷ 预期增长率，< 0.6 便宜、≈1 合理、>1.2 昂贵',
      '成长股七大标准：强增长、低PEG、现金流、相对强度、管理层持股、乐观故事、低资产负债率',
      '相对强度：股价强于大盘的股票倾向于继续强',
    ],
    quote: '小投资者可以像祖鲁人一样，用长矛战胜大炮。',
  },
  {
    name: '炒股养家', cat: 'youzi', tag: 'A股顶级游资 · 情绪周期理论', kind: 'person',
    intro: 'A股知名游资（网络流传身份为某上海职业投资人），从数十万做到数亿规模，"情绪周期"与"心法"被广泛传播。',
    points: [
      '情绪周期：启动→发酵→高潮→退潮，龙头股死于一致、生于分歧',
      '龙头战法：只做主线板块的龙头股，"宁做鸡头不做凤尾"',
      '买入机会，卖出风险：分歧转一致时买入，一致转分歧时卖出',
      '仓位管理：确定性高重仓出击，看不懂时空仓等待',
    ],
    quote: '心中无顶底，操作自随心。',
  },
  {
    name: '赵老哥', cat: 'youzi', tag: 'A股知名游资 · 八年一万倍', kind: 'person',
    intro: 'A股传奇游资（网络流传），以"八年一万倍"成名，擅长涨停板打板接力，风格凌厉。',
    points: [
      '打板接力：在涨停瞬间排队买入，赌次日惯性高开溢价',
      '只做强势股：龙头、题材、人气缺一不可',
      '严格的止损纪律：炸板/低开不及预期立刻出，绝不成股东',
      '复利思维：小资金靠高频复利滚大，控制回撤是生命线',
    ],
    quote: '的模式再好，不在主流题材里都是白搭。',
  },
  {
    name: '乔帮主（低吸流）', cat: 'youzi', tag: 'A股知名游资 · 半路低吸', kind: 'person',
    intro: 'A股知名游资（网络流传），与打板流不同，以"强势股回调低吸"见长，讲究买在分歧。',
    points: [
      '低吸不追高：强势主线股回调 3-5% 时分批低吸',
      '只做人气股：成交活跃、龙虎榜常客的标的才有波动空间',
      '当日了断：T+1 环境下尾盘或次日冲高即兑现',
      '敬畏市场：情绪退潮期空仓，不做逆势抄底',
    ],
    quote: '低吸是最好的防守，买在别人恐慌时。',
  },
]);

const filters = [
  { key: 'all', name: '全部' },
  { key: 'person', name: '名人类' },
  { key: 'book', name: '书籍类' },
  { key: 'youzi', name: '国产游资类' },
];
const filter = ref('all');
const filteredMasters = computed(() =>
  filter.value === 'all' ? masters.value : masters.value.filter((m) => m.cat === filter.value),
);

function toggle(i: number) {
  masters.value[i].open = !masters.value[i].open;
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 10px 10px 20px;
}
.hero {
  background: linear-gradient(135deg, #16a085, #1abc9c);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-title { color: #fff; font-size: 20px; font-weight: 700; }
.hero-sub { color: rgba(255, 255, 255, 0.85); font-size: 12px; }
.filter-row {
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 12px 4px 0;
  flex-wrap: wrap;
}
.filter-chip {
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 15px;
  background: #fff;
  color: #16a085;
  border: 1px solid #16a085;
}
.filter-chip.on {
  background: #16a085;
  color: #fff;
  font-weight: 600;
}
.cat-text { font-size: 14px; font-weight: 700; color: #16a085; }
.card {
  background: #fff;
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px 14px;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 17px;
  text-align: center;
  line-height: 34px;
  font-size: 14px;
  font-weight: 700;
  margin-right: 10px;
  flex-shrink: 0;
}
.av-person { background: #e8f8f5; color: #16a085; }
.av-book { background: #fef9e7; color: #b7950b; }
.head-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.m-name { font-size: 15px; font-weight: 600; color: #212529; }
.m-tag { font-size: 11px; color: #999; }
.card-arrow { color: #adb5bd; font-size: 13px; transition: transform 0.2s; }
.card-arrow.open { transform: rotate(180deg); }
.card-body {
  padding: 2px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.m-intro { font-size: 13px; color: #495057; line-height: 1.7; }
.blk { margin-top: 4px; display: flex; flex-direction: column; gap: 4px; }
.blk-label {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e8f8f5;
  color: #16a085;
}
.pt { display: flex; flex-direction: row; margin-top: 2px; }
.pt-dot { color: #16a085; font-size: 12px; margin-right: 6px; flex-shrink: 0; }
.pt-text { flex: 1; font-size: 12px; color: #495057; line-height: 1.6; }
.quote {
  margin-top: 6px;
  background: #f0faf7;
  border-left: 3px solid #16a085;
  border-radius: 6px;
  padding: 8px 10px;
}
.quote-text { color: #0e6655; font-size: 12px; line-height: 1.6; font-style: italic; }
.footer {
  text-align: center;
  color: #adb5bd;
  font-size: 11px;
  padding: 16px 0 4px;
}
</style>
