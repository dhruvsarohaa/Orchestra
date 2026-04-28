export type StreamArgs = {
  prompt: string;
  modelId: string;
  apiKey: string;
  image?: { mimeType: string; data: string } | null;
  signal: AbortSignal;
  onDelta: (chunk: string) => void;
};

async function readSseLines(
  res: Response,
  signal: AbortSignal,
  onLine: (line: string) => void,
) {
  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    if (signal.aborted) {
      try { await reader.cancel(); } catch {}
      return;
    }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIdx;
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nlIdx).replace(/\r$/, '');
      buffer = buffer.slice(nlIdx + 1);
      if (line) onLine(line);
    }
  }
  if (buffer) onLine(buffer);
}

export async function streamGemini({ prompt, modelId, apiKey, image, signal, onDelta }: StreamArgs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal,
  });
  await readSseLines(res, signal, line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const parsed = JSON.parse(data);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string') onDelta(text);
    } catch {}
  });
}

async function streamOpenAiCompatible(args: {
  url: string;
  headers: Record<string, string>;
  body: any;
  signal: AbortSignal;
  onDelta: (chunk: string) => void;
}) {
  const res = await fetch(args.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...args.headers },
    body: JSON.stringify(args.body),
    signal: args.signal,
  });
  await readSseLines(res, args.signal, line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') args.onDelta(delta);
    } catch {}
  });
}

export async function streamGroq({ prompt, modelId, apiKey, signal, onDelta }: StreamArgs) {
  await streamOpenAiCompatible({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { model: modelId, messages: [{ role: 'user', content: prompt }], stream: true },
    signal,
    onDelta,
  });
}

export async function streamOpenRouter({ prompt, modelId, apiKey, signal, onDelta }: StreamArgs) {
  await streamOpenAiCompatible({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'OrchestrateAI',
    },
    body: { model: modelId, messages: [{ role: 'user', content: prompt }], stream: true },
    signal,
    onDelta,
  });
}

export async function streamTogether({ prompt, modelId, apiKey, signal, onDelta }: StreamArgs) {
  await streamOpenAiCompatible({
    url: 'https://api.together.xyz/v1/chat/completions',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { model: modelId, messages: [{ role: 'user', content: prompt }], stream: true },
    signal,
    onDelta,
  });
}

export async function streamAnthropic({ prompt, modelId, apiKey, signal, onDelta }: StreamArgs) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  await readSseLines(res, signal, line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        onDelta(parsed.delta.text || '');
      }
    } catch {}
  });
}

export type ProviderId = 'google' | 'groq' | 'openrouter' | 'anthropic' | 'together';

const STREAMERS: Record<ProviderId, (a: StreamArgs) => Promise<void>> = {
  google: streamGemini,
  groq: streamGroq,
  openrouter: streamOpenRouter,
  anthropic: streamAnthropic,
  together: streamTogether,
};

export async function streamFor(
  provider: ProviderId,
  args: StreamArgs,
): Promise<{ ok: true } | { ok: false; error: Error }> {
  try {
    await STREAMERS[provider](args);
    return { ok: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: true };
    return { ok: false, error: err };
  }
}

export async function nonStreamingFallback(
  provider: ProviderId,
  args: Omit<StreamArgs, 'onDelta' | 'signal'> & { signal?: AbortSignal },
): Promise<string> {
  const { prompt, modelId, apiKey, image, signal } = args;
  if (provider === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const parts: any[] = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal,
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text || '';
  }
  const cfg: { url: string; headers: Record<string, string> } =
    provider === 'groq'
      ? { url: 'https://api.groq.com/openai/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}` } }
      : provider === 'together'
      ? { url: 'https://api.together.xyz/v1/chat/completions', headers: { Authorization: `Bearer ${apiKey}` } }
      : {
          url: 'https://openrouter.ai/api/v1/chat/completions',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'OrchestrateAI',
          },
        };
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cfg.headers },
    body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }] }),
    signal,
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}
