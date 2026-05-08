import type { LLMRequest } from '../types';
import { parseSseResponse } from '../sse';

function buildContents(prompt: string, image?: LLMRequest['image']) {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (image?.mimeType && image.data) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }
  return [{ parts }];
}

function generationConfig(temperature?: number, maxTokens?: number) {
  return {
    ...(typeof temperature === 'number' ? { temperature } : {}),
    ...(typeof maxTokens === 'number' ? { maxOutputTokens: maxTokens } : {}),
  };
}

export async function* streamGoogle(req: LLMRequest): AsyncGenerator<string, void, unknown> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.modelId)}` +
    `:streamGenerateContent?alt=sse&key=${encodeURIComponent(req.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: buildContents(req.prompt, req.image),
      generationConfig: generationConfig(req.temperature, req.maxTokens),
    }),
    signal: req.signal,
  });
  for await (const line of parseSseResponse(res, req.signal)) {
    try {
      const parsed = JSON.parse(line);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string' && text) yield text;
    } catch {
      // no-op
    }
  }
}

export async function generateGoogle(req: LLMRequest): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.modelId)}` +
    `:generateContent?key=${encodeURIComponent(req.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: buildContents(req.prompt, req.image),
      generationConfig: generationConfig(req.temperature, req.maxTokens),
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
