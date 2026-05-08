import { generateAnthropic, streamAnthropic } from './providers/anthropic';
import { generateGoogle, streamGoogle } from './providers/google';
import { generateGroq, streamGroq } from './providers/groq';
import { generateOpenRouter, streamOpenRouter } from './providers/openrouter';
import { generateTogether, streamTogether } from './providers/together';
import type { LLMRequest, ProviderId } from './types';

type ProviderFns = {
  stream: (req: LLMRequest) => AsyncGenerator<string, void, unknown>;
  generate: (req: LLMRequest) => Promise<string>;
};

const PROVIDERS: Record<ProviderId, ProviderFns> = {
  google: { stream: streamGoogle, generate: generateGoogle },
  groq: { stream: streamGroq, generate: generateGroq },
  openrouter: { stream: streamOpenRouter, generate: generateOpenRouter },
  anthropic: { stream: streamAnthropic, generate: generateAnthropic },
  together: { stream: streamTogether, generate: generateTogether },
};

export const providerFromHeader = (value: string | undefined): ProviderId => {
  if (value === 'google' || value === 'groq' || value === 'openrouter' || value === 'anthropic' || value === 'together') {
    return value;
  }
  return 'google';
};

export function streamLLM(req: LLMRequest) {
  return PROVIDERS[req.provider].stream(req);
}

export function generateLLM(req: LLMRequest) {
  return PROVIDERS[req.provider].generate(req);
}

export * from './types';
export * from './sse';
