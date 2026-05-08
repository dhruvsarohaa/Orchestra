export type StreamArgs = {
  prompt: string;
  modelId: string;
  apiKey: string;
  image?: { mimeType: string; data: string } | null;
  temperature?: number;
  maxTokens?: number;
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

export async function streamGemini({ prompt, modelId, apiKey, image, temperature, maxTokens, signal, onDelta }: StreamArgs) {
  return streamFromApi('google', { prompt, modelId, apiKey, image, temperature, maxTokens, signal, onDelta });
}

async function streamFromApi(provider: ProviderId, args: StreamArgs) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/llm/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-provider-id': provider,
      'x-provider-key': args.apiKey,
    },
    body: JSON.stringify({
      providerId: provider,
      prompt: args.prompt,
      modelId: args.modelId,
      image: args.image ?? null,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
    }),
    signal: args.signal,
  });
  await readSseLines(res, args.signal, line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed?.delta === 'string') args.onDelta(parsed.delta);
    } catch {}
  });
}

export async function streamGroq({ prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta }: StreamArgs) {
  return streamFromApi('groq', { prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta });
}

export async function streamOpenRouter({ prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta }: StreamArgs) {
  return streamFromApi('openrouter', { prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta });
}

export async function streamTogether({ prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta }: StreamArgs) {
  return streamFromApi('together', { prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta });
}

export async function streamAnthropic({ prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta }: StreamArgs) {
  return streamFromApi('anthropic', { prompt, modelId, apiKey, temperature, maxTokens, signal, onDelta });
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
  const { prompt, modelId, apiKey, image, signal, temperature, maxTokens } = args;
  const res = await fetch(`${import.meta.env.BASE_URL}api/llm/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-provider-id': provider,
      'x-provider-key': apiKey,
    },
    body: JSON.stringify({
      providerId: provider,
      prompt,
      modelId,
      image: image ?? null,
      temperature,
      maxTokens,
    }),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`${provider} ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  const data = await res.json();
  return data?.text || '';
}
