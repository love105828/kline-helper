<template>
  <view class="page">
    <!-- 顶部 -->
    <view class="head">
      <text class="head-title">AI 助手</text>
      <text class="head-sub">BYOK 模式 · Key 只存本地 · 对话自动携带当前标的缠论结构</text>
    </view>

    <!-- 服务商管理 -->
    <view class="card">
      <view class="sec-head">
        <text class="sec-title">服务商</text>
        <text class="sec-add" @click="openAdd">＋ 添加</text>
      </view>
      <!-- 预设模板 -->
      <view class="preset-row">
        <text class="preset-label">快速添加：</text>
        <text v-for="(p, j) in PRESETS" :key="j" class="preset-chip" @click="applyPreset(p)">{{ p.name }}</text>
      </view>
      <view v-for="(p, j) in providers" :key="p.id" class="prov-row" :class="{ act: p.id === activeId }">
        <view class="prov-main" @click="setActive(p.id)">
          <text class="prov-name">{{ p.id === activeId ? '● ' : '○ ' }}{{ p.name }}</text>
          <text class="prov-meta">{{ p.protocol === 'gemini' ? 'Gemini' : 'OpenAI兼容' }} · {{ p.model }} · {{ p.baseUrl.replace('https://', '').slice(0, 26) }}</text>
        </view>
        <view class="prov-ops">
          <text class="op" @click.stop="testProv(p.id)">{{ testing === p.id ? '测试中' : '测试' }}</text>
          <text class="op" @click.stop="openEdit(p.id)">编辑</text>
          <text class="op del" @click.stop="delProv(p.id)">删除</text>
        </view>
      </view>
      <view v-if="testResult" class="test-result" :class="{ ok: testResult.ok, bad: !testResult.ok }">{{ testResult.msg }}</view>
      <view v-if="!providers.length" class="empty-prov">还没有服务商，点上方"＋ 添加"或用快速模板</view>
    </view>

    <!-- 聊天区 -->
    <view class="card chat-card">
      <view class="sec-head">
        <text class="sec-title">对话</text>
        <view class="chat-ops">
          <text class="chat-op" @click="analyzeCurrent">分析当前标的</text>
          <text class="chat-op" @click="clearChat">清空</text>
        </view>
      </view>
      <scroll-view :scroll-y="true" class="msg-list" :scroll-into-view="scrollInto">
        <view v-for="(m, j) in msgs" :key="j" class="msg" :class="'msg-' + m.role">
          <view v-if="m.role === 'system'" class="msg-sys">{{ m.content }}</view>
          <view v-else class="bubble" :class="'bubble-' + m.role">
            <text class="bubble-text">{{ m.content }}<text v-if="m.streaming" class="cursor">▍</text></text>
          </view>
        </view>
        <view v-if="!msgs.length" class="chat-empty">
          <text class="chat-empty-text">输入问题，或点"分析当前标的"让 AI 解读 {{ prefs.name }} 的缠论结构。</text>
        </view>
      </scroll-view>
      <view class="input-row">
        <input v-model="draft" class="chat-input" placeholder="输入问题…" confirm-type="send" :maxlength="-1" @confirm="send" />
        <view class="send-btn" :class="{ disabled: !canSend }" @click="send">{{ running ? '…' : '发送' }}</view>
      </view>
    </view>

    <view class="footer">对话自动携带当前标的（{{ prefs.name }} {{ periodLabels[prefs.period] }}）的缠论结构数据。回复仅供学习研究。</view>

    <!-- 提示词展示弹窗（复制到外部 AI） -->
    <view v-if="promptModal" class="mask">
      <view class="prompt-sheet" @click.stop>
        <view class="prompt-head">
          <text class="prompt-title">缠论分析提示词</text>
          <text class="prompt-close" @click="promptModal = false">×</text>
        </view>
        <text class="prompt-hint">复制以下内容，粘贴到任意 AI 对话工具即可获取分析</text>
        <textarea :value="promptText" class="prompt-textarea" :maxlength="-1" disabled></textarea>
        <view class="prompt-btns">
          <view class="prompt-btn main" @click="copyPrompt">{{ copied ? '✓ 已复制' : '复制全文' }}</view>
          <view class="prompt-btn ghost" @click="promptModal = false">关闭</view>
        </view>
      </view>
    </view>

    <!-- 服务商表单（点遮罩不关闭，防止误触丢失） -->
    <view v-if="formOpen" class="mask">
      <view class="form-sheet" @click.stop>
        <view class="form-title">{{ editId ? '编辑' : '添加' }}服务商（{{ formProtocolName }}）</view>
        <view class="form-row"><text class="form-label">协议</text>
          <view class="form-seg">
            <view class="form-seg-item" :class="{ on: form.protocol === 'openai' }" @click="form.protocol = 'openai'">OpenAI 兼容</view>
            <view class="form-seg-item" :class="{ on: form.protocol === 'anthropic' }" @click="form.protocol = 'anthropic'">Anthropic 兼容</view>
          </view>
        </view>
        <view class="form-row"><text class="form-label">名称</text><input v-model="form.name" class="form-input" placeholder="随意，如 DeepSeek" /></view>
        <view class="form-row"><text class="form-label">接口地址</text><input v-model="form.baseUrl" class="form-input" :placeholder="protocolPlaceholder" /></view>
        <view class="form-row"><text class="form-label">API Key</text><input v-model="form.apiKey" class="form-input" placeholder="sk-..." :password="true" /></view>
        <view class="form-row"><text class="form-label">模型</text><input v-model="form.model" class="form-input" :placeholder="protocolModelPh" /></view>
        <view v-if="formErr" class="form-err">{{ formErr }}</view>
        <view class="form-btns">
          <view class="form-btn ghost" @click="testForm">{{ testingForm ? '测试中…' : '测试连接' }}</view>
          <view class="form-btn main" @click="saveForm">保存</view>
        </view>
        <view v-if="formTestResult" class="test-result" :class="{ ok: formTestResult.ok, bad: !formTestResult.ok }">{{ formTestResult.msg }}</view>
        <view class="form-cancel" @click="closeForm">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/** AI 助手页：服务商管理（预设/编辑/测试）+ 对话（流式、带缠论上下文） */
import { ref, computed, nextTick } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { chatStream, chatOnce, testConnection } from '../../ai/client';
import type { AiProtocol } from '../../ai/client';
import { buildChanContext } from '../../ai/context';
import { fetchKline, toSymbol, PERIOD_LABELS } from '../../api/cnfin';
import { computeChan } from '../../chan/index';
import { getChanCache, setChanCache } from '../../ai/cache';
import { getPrefs } from '../../utils/storage';
import {
  getAiProviders, saveAiProviders, getActiveAiProvider, setActiveAiProvider,
} from '../../utils/storage';

interface AiProviderX {
  id: string; name: string; protocol: AiProtocol;
  baseUrl: string; apiKey: string; model: string;
}

const prefs = getPrefs();
const periodLabels = PERIOD_LABELS;

const PRESETS: { name: string; protocol: AiProtocol; baseUrl: string; model: string }[] = [
  { name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱GLM', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: 'Kimi', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'OpenRouter', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'Anthropic 兼容', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-20241022' },
];

const providers = ref<AiProviderX[]>(getAiProviders().map((p) => ({ protocol: 'openai', ...p })) as AiProviderX[]);
const activeId = ref<string>((getActiveAiProvider() as AiProviderX | null)?.id || '');
const formOpen = ref(false);
const editId = ref<string | null>(null);
const form = ref<AiProviderX>({ id: '', name: '', protocol: 'openai', baseUrl: '', apiKey: '', model: '' });
const formErr = ref('');
const formTestResult = ref<{ ok: boolean; msg: string } | null>(null);
const testingForm = ref(false);
const testing = ref('');
const testResult = ref<{ ok: boolean; msg: string } | null>(null);

const msgs = ref<{ role: 'user' | 'assistant' | 'system'; content: string; streaming?: boolean }[]>([]);
const draft = ref('');
const running = ref(false);
const scrollInto = ref('');

const canSend = computed(() => !running.value && draft.value.trim() && activeId.value);

const PROTOCOL_META: Record<AiProtocol, { name: string; baseUrl: string; model: string }> = {
  openai: { name: 'OpenAI 兼容', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  gemini: { name: 'Gemini 原生', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  anthropic: { name: 'Anthropic 兼容', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-haiku-20241022' },
};
const formProtocolName = computed(() => PROTOCOL_META[form.value.protocol]?.name || '');
const protocolPlaceholder = computed(() => PROTOCOL_META[form.value.protocol]?.baseUrl || '');
const protocolModelPh = computed(() => PROTOCOL_META[form.value.protocol]?.model || '');

/* ---------------- 服务商管理 ---------------- */
const applyPreset = (p: { name: string; protocol: AiProtocol; baseUrl: string; model: string }) => {
  form.value = { id: 'p' + Date.now(), name: p.name, protocol: p.protocol, baseUrl: p.baseUrl, apiKey: '', model: p.model };
  editId.value = null;
  formErr.value = '';
  formTestResult.value = null;
  formOpen.value = true;
};
const openAdd = () => applyPreset({ name: '', protocol: 'openai', baseUrl: '', model: '' });
const openEdit = (id: string) => {
  const p = providers.value.find((x) => x.id === id);
  if (!p) return;
  form.value = { ...p };
  editId.value = id;
  formErr.value = '';
  formTestResult.value = null;
  formOpen.value = true;
};
const saveForm = () => {
  const f = form.value;
  if (!f.baseUrl.trim()) { formErr.value = '请填写接口地址'; return; }
  if (!f.apiKey.trim()) { formErr.value = '请填写 API Key'; return; }
  if (!f.model.trim()) { formErr.value = '请填写模型名'; return; }
  const item: AiProviderX = {
    id: editId.value || f.id,
    name: f.name.trim() || f.model.trim(),
    protocol: f.protocol,
    baseUrl: f.baseUrl.trim(),
    apiKey: f.apiKey.trim(),
    model: f.model.trim(),
  };
  const list = providers.value.filter((x) => x.id !== item.id);
  list.push(item);
  providers.value = list;
  saveAiProviders(list);
  if (!activeId.value || !editId.value) { activeId.value = item.id; setActiveAiProvider(item.id); }
  formOpen.value = false;
};
const closeForm = () => { formOpen.value = false; };
const delProv = (id: string) => {
  providers.value = providers.value.filter((x) => x.id !== id);
  saveAiProviders(providers.value);
  if (activeId.value === id) activeId.value = providers.value[0]?.id || '';
};
const setActive = (id: string) => {
  activeId.value = id;
  setActiveAiProvider(id);
};
const testProv = async (id: string) => {
  const p = providers.value.find((x) => x.id === id);
  if (!p) return;
  testing.value = id;
  testResult.value = null;
  uni.showToast({ title: '测试中…', icon: 'none', duration: 500 });
  const r = await testConnection(p);
  testing.value = '';
  testResult.value = r;
  uni.showToast({ title: r.msg, icon: 'none', duration: 2000 });
};
const testForm = async () => {
  const f = form.value;
  if (!f.baseUrl.trim() || !f.apiKey.trim() || !f.model.trim()) { formErr.value = '请先填完整地址、Key 和模型'; return; }
  testingForm.value = true;
  formTestResult.value = null;
  formTestResult.value = await testConnection(f);
  testingForm.value = false;
};

/* ---------------- 聊天 ---------------- */
const AI_SYSTEM = '你是一位精通缠论与技术分析的中文助手。基于用户提供的K线缠论结构数据（笔/段/中枢/买卖点/MACD），输出结构化分析：1)当前走势结构与所处位置 2)关键支撑与压力（引用中枢区间数值） 3)最近买卖点含义与风险提示 4)操作思路建议。语言简洁专业，引用数据时使用给定数值。结尾必须注明"以上分析仅供学习研究，不构成投资建议"。对不确定的地方明确说明不确定。';

const scrollToBottom = () => {
  nextTick(() => {
    scrollInto.value = 'msg-bottom';
  });
};

const send = async () => {
  const q = draft.value.trim();
  if (!q || running.value) return;
  if (!activeId.value) {
    uni.showToast({ title: '请先添加并选中服务商', icon: 'none' });
    return;
  }
  const prov = providers.value.find((x) => x.id === activeId.value);
  if (!prov) return;

  // 计算当前标的缠论结构（优先用缓存，避免重复拉取延迟）
  let context = '';
  try {
    const sym = toSymbol(prefs.symbol);
    const cached = getChanCache(sym, prefs.period, prefs.fq);
    if (cached) {
      context = buildChanContext(cached.klines, cached.draw, { name: prefs.name || prefs.symbol, symbol: sym, period: PERIOD_LABELS[prefs.period] });
    } else {
      const kl = await fetchKline(sym, prefs.period, 1440, prefs.fq);
      const draw = computeChan(kl, { gap: prefs.biMode === 'strict' ? 4 : 3 });
      context = buildChanContext(kl, draw, { name: prefs.name || prefs.symbol, symbol: sym, period: PERIOD_LABELS[prefs.period] });
    }
  } catch { /* 拉取失败时无上下文继续对话 */ }

    msgs.value.push({ role: 'user', content: q });
  msgs.value.push({ role: 'assistant' as const, content: '思考中…', streaming: true });
  // 取响应式代理引用：流式增量更新才能实时上屏
  const aiMsg = msgs.value[msgs.value.length - 1];
  draft.value = '';
  running.value = true;
  scrollToBottom();

  const history = msgs.value
    .filter((m) => m.role !== 'system' && !m.streaming)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // 独立变量追踪实际流式内容（与 UI 占位符分离）
  let streamedContent = '';

  const run = async (stream: boolean) => {
    streamedContent = '';
    await chatStream({
      protocol: prov.protocol,
      baseUrl: prov.baseUrl,
      apiKey: prov.apiKey,
      model: prov.model,
      messages: [
        { role: 'system', content: AI_SYSTEM + (context ? '\n\n用户当前查看的标的数据如下：\n' + context : '') },
        ...history,
      ],
      onDelta: (t) => {
        streamedContent += t;
        if (aiMsg.content === '思考中…') aiMsg.content = '';
        aiMsg.content += t;
        scrollToBottom();
      },
    });
  };

  try {
    await run(true);
    if (!streamedContent.trim()) {
      // 流式返回空 → 非流式兜底重试
      aiMsg.content = '非流式重试中…';
      streamedContent = '';
      await run(false);
    }
  } catch (streamErr: any) {
    if (!streamedContent.trim()) {
      // 流式失败且无内容 → 非流式重试
      aiMsg.content = '非流式重试中…';
      try {
        await run(false);
      } catch (retryErr: any) {
        aiMsg.content = '❌ ' + (retryErr?.message || retryErr);
        aiMsg.streaming = false;
        return;
      }
    } else {
      aiMsg.content = streamedContent;
      aiMsg.streaming = false;
      uni.showToast({ title: '部分内容可能丢失：' + (streamErr?.message || '').slice(0, 60), icon: 'none' });
      return;
    }
  }
  if (!streamedContent.trim()) {
    // 两种方式都没有内容 → 非流式 chatOnce 最终兜底
    aiMsg.content = '重试中…';
    try {
      const fb = await chatOnce({
        protocol: prov.protocol,
        baseUrl: prov.baseUrl,
        apiKey: prov.apiKey,
        model: prov.model,
        messages: [
          { role: 'system', content: AI_SYSTEM + (context ? '\n\n用户当前查看的标的数据如下：\n' + context : '') },
          ...history,
        ],
      });
      aiMsg.content = fb || '（模型未返回内容，请检查模型名和接口地址）';
    } catch (e: any) {
      aiMsg.content = '❌ ' + (e?.message || e);
    }
  }
  aiMsg.content = streamedContent || aiMsg.content;
  aiMsg.streaming = false;
  running.value = false;
  scrollToBottom();
};

/** 一键分析当前标的 → 展示提示词供复制到外部 AI */
const promptModal = ref(false);
const promptText = ref('');
const copied = ref(false);
const analyzeCurrent = async () => {
  const sym = toSymbol(prefs.symbol);
  let context = '';
  const cached = getChanCache(sym, prefs.period, prefs.fq);
  if (cached) {
    context = buildChanContext(cached.klines, cached.draw, { name: prefs.name || prefs.symbol, symbol: sym, period: PERIOD_LABELS[prefs.period] });
  } else {
    // 无缓存时拉取（UI 可能卡 1-2 秒但保证有内容）
    try {
      const kl = await fetchKline(sym, prefs.period, 1440, prefs.fq);
      const draw = computeChan(kl, { gap: prefs.biMode === 'strict' ? 4 : 3 });
      setChanCache(sym, prefs.period, prefs.fq, kl, draw);
      context = buildChanContext(kl, draw, { name: prefs.name || prefs.symbol, symbol: sym, period: PERIOD_LABELS[prefs.period] });
    } catch { /* 拉取失败时仍显示提示词框架 */ }
  }
  promptText.value = AI_SYSTEM + '\n\n' + context;
  copied.value = false;
  promptModal.value = true;
};
const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(promptText.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    // 降级方案：创建临时 textarea 复制
    const ta = document.createElement('textarea');
    ta.value = promptText.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }
};

const clearChat = () => {
  if (running.value) { uni.showToast({ title: '回复中，请稍候', icon: 'none' }); return; }
  msgs.value = [];
};

onShow(() => {
  // 主页跳转过来时刷新服务商列表
  providers.value = getAiProviders().map((p) => ({ protocol: 'openai', ...p })) as AiProviderX[];
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  background-color: #f5f6fa;
  padding: 10px 10px 20px;
  display: flex;
  flex-direction: column;
}
.head {
  background: linear-gradient(135deg, #5f27cd, #8e44ad);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.head-title { color: #fff; font-size: 19px; font-weight: 700; }
.head-sub { color: rgba(255, 255, 255, 0.85); font-size: 11px; }
.card {
  background: #fff;
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
}
.sec-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 6px;
}
.sec-title { font-size: 14px; font-weight: 700; color: #212529; }
.sec-add { font-size: 12px; color: #8e44ad; font-weight: 600; }
.preset-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 14px 10px;
}
.preset-label { font-size: 11px; color: #999; }
.preset-chip {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  background: #f3e9fd;
  color: #8e44ad;
}
.preset-chip:active { opacity: 0.7; }
.prov-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid #f5f5f5;
}
.prov-row.act { background: #faf7ff; }
.prov-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.prov-name { font-size: 13px; color: #333; }
.prov-name.act { color: #8e44ad; font-weight: 600; }
.prov-meta { font-size: 10px; color: #bbb; }
.prov-ops { display: flex; flex-direction: row; gap: 8px; flex-shrink: 0; }
.op { font-size: 12px; color: #8e44ad; }
.op.del { color: #ec0000; }
.test-result {
  margin: 6px 14px 10px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
}
.test-result.ok { background: #e6f7ef; color: #00a854; }
.test-result.bad { background: #fdecea; color: #ec0000; }
.empty-prov { padding: 10px 14px 14px; font-size: 12px; color: #bbb; }

/* 提示词展示弹窗 */
.prompt-sheet {
  width: 90%;
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}
.prompt-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.prompt-title { font-size: 15px; font-weight: 700; color: #212529; }
.prompt-close { font-size: 20px; color: #adb5bd; }
.prompt-hint { font-size: 11px; color: #8e44ad; margin-bottom: 8px; }
.prompt-textarea {
  width: 100%;
  height: 280px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  font-family: monospace;
  color: #333;
  box-sizing: border-box;
}
.prompt-btns { display: flex; flex-direction: row; gap: 10px; margin-top: 10px; }
.prompt-btn { flex: 1; height: 38px; line-height: 38px; text-align: center; border-radius: 19px; font-size: 13px; }
.prompt-btn.main { background: #8e44ad; color: #fff; font-weight: 600; }
.prompt-btn.ghost { background: #fff; border: 1px solid #dee2e6; color: #6c757d; }

/* 聊天 */
.chat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 420px;
}
.chat-ops { display: flex; flex-direction: row; gap: 12px; }
.chat-op { font-size: 12px; color: #8e44ad; }
.msg-list {
  flex: 1;
  min-height: 300px;
  max-height: 52vh;
  padding: 6px 10px;
  box-sizing: border-box;
}
.msg { margin: 6px 0; }
.msg-sys {
  text-align: center;
  font-size: 10px;
  color: #bbb;
  padding: 4px 0;
}
.bubble {
  max-width: 88%;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.7;
}
.bubble-user {
  margin-left: auto;
  background: #8e44ad;
  color: #fff;
  border-bottom-right-radius: 3px;
}
.bubble-assistant {
  margin-right: auto;
  background: #f1f2f6;
  color: #212529;
  border-bottom-left-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}
.cursor { color: #8e44ad; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }
.chat-empty { text-align: center; padding: 30px 20px; }
.chat-empty-text { font-size: 12px; color: #bbb; line-height: 1.8; }
.input-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid #f0f0f0;
}
.chat-input {
  flex: 1;
  height: 36px;
  background: #f0f2f5;
  border-radius: 18px;
  padding: 0 14px;
  font-size: 13px;
}
.send-btn {
  width: 56px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  border-radius: 18px;
  background: #8e44ad;
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}
.send-btn.disabled { opacity: 0.5; }

/* 表单 */
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.form-sheet {
  width: 90%;
  max-width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  max-height: 86vh;
  overflow-y: auto;
}
.form-title { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 10px; }
.form-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 0;
  gap: 10px;
}
.form-label { width: 64px; font-size: 13px; color: #495057; flex-shrink: 0; }
.form-input {
  flex: 1;
  height: 34px;
  background: #f0f2f5;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
}
.form-seg { display: flex; border: 1px solid #8e44ad; border-radius: 6px; overflow: hidden; flex: 1; }
.form-seg-item { flex: 1; text-align: center; padding: 6px 0; font-size: 12px; color: #8e44ad; }
.form-seg-item.on { background: #8e44ad; color: #fff; }
.form-err { color: #ec0000; font-size: 12px; margin: 6px 0; }
.form-btns { display: flex; flex-direction: row; gap: 10px; margin-top: 12px; }
.form-btn { flex: 1; height: 38px; line-height: 38px; text-align: center; border-radius: 19px; font-size: 13px; }
.form-btn.ghost { background: #fff; border: 1px solid #8e44ad; color: #8e44ad; }
.form-btn.main { background: #8e44ad; color: #fff; font-weight: 600; }
.form-cancel { text-align: center; color: #999; font-size: 13px; padding-top: 10px; }

.footer {
  text-align: center;
  color: #adb5bd;
  font-size: 11px;
  padding: 14px 0 4px;
}
</style>
