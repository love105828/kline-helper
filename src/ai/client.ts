/**
 * AI 流式客户端（多协议）
 * - openai:    OpenAI 兼容 /chat/completions（DeepSeek/智谱/Kimi/OpenRouter 等）
 * - anthropic: Claude 原生 /messages
 * 错误分类：401 Key 无效 / 402·429 余额或限流 / 404 地址或模型错误
 */

export type AiProtocol = 'openai' | 'anthropic';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  protocol?: AiProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  onDelta?: (text: string) => void;
}

export function friendlyError(status: number, body: string): string {
  if (status === 401) return 'API Key 无效或未授权（401）——请检查 Key';
  if (status === 402) return '账户余额不足（402）——请前往服务商充值';
  if (status === 403) return '无权访问该模型（403）——检查 Key 权限或模型名';
  if (status === 404) return '接口地址或模型不存在（404）——检查地址和模型名';
  if (status === 429) return '请求过于频繁或额度耗尽（429）——稍后重试';
  if (status >= 500) return `服务商服务器错误（${status}）——稍后重试`;
  return `请求失败（${status}）：${body.slice(0, 120)}`;
}

function createSseParser(onData: (json: string) => void) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      onData(payload);
    }
  };
}

function extractContent(j: any): string {
  if (j?.choices?.[0]?.message?.content) return j.choices[0].message.content;
  if (j?.choices?.[0]?.delta?.content) return j.choices[0].delta.content;
  if (j?.content) return j.content.map((c: any) => c.text || '').join('');
  return '';
}

export async function testConnection(opts: { protocol?: AiProtocol; baseUrl: string; apiKey: string; model: string }): Promise<{ ok: boolean; msg: string }> {
  try {
    const text = await chatOnce({ ...opts, messages: [{ role: 'user', content: 'hi' }] });
    return { ok: true, msg: '连接成功 ✓' };
  } catch (e: any) {
    const m = String(e?.message || e);
    if (m.includes('Failed to fetch')) return { ok: false, msg: '网络错误或该服务商不支持浏览器直连（跨域）' };
    return { ok: false, msg: m };
  }
}

export async function chatStream(opts: ChatOptions): Promise<string> {
  const protocol = opts.protocol || 'openai';
  if (protocol === 'anthropic') return chatAnthropicStream(opts);
  return chatOpenAiStream(opts);
}

async function chatOpenAiStream(opts: ChatOptions): Promise<string> {
  const url = opts.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(friendlyError(res.status, await res.text().catch(() => '')));
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/json') && !ctype.includes('event-stream')) {
    const j = await res.json();
    const msg = extractContent(j);
    if (msg && opts.onDelta) opts.onDelta(msg);
    return msg;
  }
  if (!res.body) throw new Error('当前浏览器不支持流式响应');

  let full = '';
  let raw = '';
  const parse = createSseParser((payload) => {
    raw += payload + '\n';
    try {
      const j = JSON.parse(payload);
      const delta = j?.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        opts.onDelta?.(delta);
      }
    } catch { /* 忽略 */ }
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) parse(line);
  }
  // 流式解析为空 → 整个响应体当 JSON 解析
  if (!full.trim() && raw.trim()) {
    try {
      const j = JSON.parse(raw);
      const msg = extractContent(j);
      if (msg) { opts.onDelta?.(msg); return msg; }
    } catch { /* 忽略 */ }
  }
  return full;
}

async function chatAnthropicStream(opts: ChatOptions): Promise<string> {
  const url = opts.baseUrl.replace(/\/+$/, '') + '/messages';
  const system = opts.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const msgs = opts.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: system || undefined,
      messages: msgs,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(friendlyError(res.status, await res.text().catch(() => '')));
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/json') && !ctype.includes('event-stream')) {
    const j = await res.json();
    const txt = (j?.content || []).map((c: any) => c.text || '').join('');
    if (txt && opts.onDelta) opts.onDelta(txt);
    return txt;
  }
  if (!res.body) throw new Error('当前浏览器不支持流式响应');

  let full = '';
  const parse = createSseParser((payload) => {
    try {
      const j = JSON.parse(payload);
      if (j?.type === 'content_block_delta' && j?.delta?.text) {
        full += j.delta.text;
        opts.onDelta?.(j.delta.text);
      }
    } catch { /* 忽略 */ }
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) parse(line);
  }
  return full;
}

/** 非流式兜底 */
export async function chatOnce(opts: ChatOptions): Promise<string> {
  const protocol = opts.protocol || 'openai';
  if (protocol === 'anthropic') {
    const url = opts.baseUrl.replace(/\/+$/, '') + '/messages';
    const system = opts.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model, max_tokens: 4096,
        system: system || undefined,
        messages: opts.messages.filter((m) => m.role !== 'system'),
      }),
    });
    if (!r.ok) throw new Error(friendlyError(r.status, await r.text().catch(() => '')));
    const j = await r.json();
    return (j?.content || []).map((c: any) => c.text || '').join('');
  }
  const url = opts.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({ model: opts.model, messages: opts.messages, temperature: opts.temperature ?? 0.7 }),
  });
  if (!r.ok) throw new Error(friendlyError(r.status, await r.text().catch(() => '')));
  const j = await r.json();
  return extractContent(j);
}
