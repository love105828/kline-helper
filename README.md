
A股K线 + 缠论自动标注（笔 / 线段 / 中枢 / 走势 / 买卖点），**无需后端**。

## 功能

- **全市场搜索**：代码/中文名/拼音联想（沪深主板、科创板、创业板、北交所、港股、美股），联想接口为腾讯 smartbox（script 标签加载绕过 CORS），离线时回退内置热门列表
- **行情页**：标的搜索联想、实时报价头、8 种周期（日/周/月/60分/30分/15分/5分/1分）
  - A股（含科创板/创业板/北交所）：中国金融信息网 `quotedata.cnfin.com`（约6年日K深度）
  - 港股 / 美股：腾讯 `web.ifzq.gtimg.cn`（K线，前复权）+ `qt.gtimg.cn`（实时）
- **缠论标注**：
  - K线包含关系合并 → 分型 → 笔（含虚笔）→ 线段（含虚段）→ 笔中枢 / 段中枢（ZG/ZD 矩形框）
  - 走势线（段中枢中点连线）、走势类型标注（上涨趋势/下跌趋势/中枢扩展）
  - 买卖点检测：一类（MACD 背驰）、三类（中枢离开回抽不回中枢）
  - 老笔（严格 gap=4）/ 新笔（宽松 gap=3）可在设置中切换
- **副图**：成交量 VOL、MACD(12,26,9)，主副图 dataZoom 联动
- **收藏页**：本地自选列表、实时价与涨跌幅、排序、删除、点击跳行情
- **全屏K线页**：独立页面专注看图
- 偏好（标的/周期/开关/笔类型）本地持久化

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | uni-app (Vue 3 + Vite + TypeScript)，H5 端 |
| 图表 | ECharts 6（按需引入：candlestick / custom series / dataZoom） |
| A股数据 | 中国金融信息网 `quotedata.cnfin.com`（免费、CORS 开放，与原站同源） |
| 港美股数据 | 腾讯 `web.ifzq.gtimg.cn`（K线）+ `qt.gtimg.cn`（实时） |
| 全市场联想 | 腾讯 `smartbox.gtimg.cn`（GBK，script 标签加载） |
| 缠论算法 | `src/chan/` 纯 TS 同构模块（可移植到 Node 后端复用） |

cnfin `candle_period` 映射（已实测验证）：`1=1分 2=5分 3=15分 4=30分 5=60分 6=日 7=周 8=月`

## 运行

```bash
npm install
npm run dev:h5          # H5 开发：http://localhost:5173
npm run build:h5        # H5 产出 dist/build/h5 静态站点
npm run dev:mp-weixin   # 小程序开发（dist/dev/mp-weixin，用微信开发者工具导入）
npm run build:mp-weixin # 小程序产出 dist/build/mp-weixin
npx vitest run          # 缠论算法单测（真实上证日K快照）
```

> Node.js >= 18。`npm install` 若遇 peer 依赖冲突，加 `--legacy-peer-deps`。

## 微信小程序

代码按 uni-app 条件编译双端适配：

| 层 | H5 | 微信小程序 |
|---|---|---|
| 图表 | echarts.init(div) + 原生鼠标拖拽 | MpEchart 容器（canvas 2d + 触摸转发 zrender） |
| 绘制配置 | `klineOption.ts` 纯函数 buildOption() 双端共享 | 同左 |
| 全市场联想 | 腾讯 smartbox（script 标签绕 CORS） | 东财 searchapi（无 CORS 概念，走白名单） |
| 港美股实时 | 东财 push2（JSON） | 同左 |
| A股行情 | cnfin（fetch / uni.request 条件编译） | 同左 |

上架步骤：注册小程序（mp.weixin.qq.com，个人主体走"工具/教育"类目，定位学习工具）→ 后台配置 request 合法域名（quotedata.cnfin.com、push2his.eastmoney.com、push2.eastmoney.com、searchapi.eastmoney.com，均 https+备案）→ `manifest.json` 填 mp-weixin.appid → 微信开发者工具导入 `dist/build/mp-weixin` → 上传体验版 → 提审发布。主包约 805KB（限制 2MB）。

## 目录结构

```
src/
├── api/cnfin.ts          # 行情 API（K线/实时快照/周期映射）
├── chan/                 # ★ 缠论算法（纯函数、可单测、同构）
│   ├── merge.ts          #   K线包含关系合并
│   ├── fenxing.ts        #   顶/底分型
│   ├── bi.ts             #   笔 + 虚笔
│   ├── duan.ts           #   线段（简化特征序列）
│   ├── zhongshu.ts       #   中枢（三元素重合 + 延伸）
│   ├── trend.ts          #   MACD / 走势类型 / 买卖点（一买一卖三买三卖）
│   └── index.ts          #   computeChan() 入口
├── components/KLineChart.vue  # ECharts K线组件（主图+VOL+MACD+缠论绘制）
├── pages/
│   ├── market/index.vue          # 行情主页
│   ├── market/fullscreen-kline.vue
│   └── watchlist/index.vue       # 收藏
└── utils/                # 收藏/偏好存储、内置标的表
tests/chan.test.ts        # 算法测试（fixtures/sh000001-day.json 真实数据）
```

## 与原站的差异

复刻范围为核心功能版。原站的登录/短信验证码、积分充值、AI 分析、
学习题库、消息中心、后端缠论计算（按次收费）均未包含——缠论算法
在本项目由**前端本地计算**，无次数限制。缠论算法为缠中说禅原文的
主流工程化实现（简化特征序列），不同流派细节可能有差异，设置中
可切换笔的严格程度。

## 免责声明

仅供学习研究，不构成任何投资建议。
