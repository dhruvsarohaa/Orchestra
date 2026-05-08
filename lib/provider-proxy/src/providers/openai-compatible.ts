import { parseSseResponse } from '../sse';
import type { LLMRequest } from '../types';

type OpenAICompatibleConfig = {
  url: string;
  headers: Record<string, string>;
};

export async function* streamOpenAICompatible(
  req: LLMRequest,
  cfg: OpenAICompatibleConfig,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cfg.headers },
    body: JSON.stringify({
      model: req.modelId,
      stream: true,
      messages: [{ role: 'user', content: req.prompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    }),
    signal: req.signal,
  });
  for await (const line of parseSseResponse(res, req.signal)) {
    try {
      const parsed = JSON.parse(line);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) yield delta;
    } catch {
      // no-op
    }
  }
}

export async function generateOpenAICompatible(req: LLMRequest, cfg: OpenAICompatibleConfig): Promise<string> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cfg.headers },
    body: JSON.stringify({
      model: req.modelId,
      messages: [{ role: 'user', content: req.prompt }],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}
