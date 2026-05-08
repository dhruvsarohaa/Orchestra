import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateLLM, providerFromHeader } from '@workspace/provider-proxy';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method not allowed' } });
    return;
  }

  const provider = providerFromHeader(String(req.headers['x-provider-id'] || 'google'));
  const apiKey = String(req.headers['x-provider-key'] || '');
  const { prompt, modelId, image, temperature, maxTokens } = req.body || {};
  if (!apiKey || !prompt || !modelId) {
    res.status(400).json({ error: { code: 'bad_request', message: 'Missing provider key, prompt, or modelId' } });
    return;
  }

  try {
    const text = await generateLLM({
      provider,
      prompt: String(prompt),
      modelId: String(modelId),
      apiKey,
      image: image ?? null,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
    });
    res.status(200).json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'generation failed';
    res.status(502).json({ error: { code: 'upstream_error', message } });
  }
}
