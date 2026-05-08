import type { LLMRequest } from '../types';
import { parseSseResponse } from '../sse';

export async function* streamAnthropic(req: LLMRequest): AsyncGenerator<string, void, unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.modelId,
      max_tokens: req.maxTokens || 2048,
      temperature: req.temperature,
      stream: true,
      messages: [{ role: 'user', content: req.prompt }],
    }),
    signal: req.signal,
  });
  for await (const line of parseSseResponse(res, req.signal)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        const text = parsed.delta.text;
        if (typeof text === 'string' && text) yield text;
      }
    } catch {
      // no-op
    }
  }
}

export async function generateAnthropic(req: LLMRequest): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.modelId,
      max_tokens: req.maxTokens || 2048,
      temperature: req.temperature,
      messages: [{ role: 'user', content: req.prompt }],
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}
