import type { LLMRequest } from '../types';
import { generateOpenAICompatible, streamOpenAICompatible } from './openai-compatible';

export function streamTogether(req: LLMRequest) {
  return streamOpenAICompatible(req, {
    url: 'https://api.together.xyz/v1/chat/completions',
    headers: { Authorization: `Bearer ${req.apiKey}` },
  });
}

export function generateTogether(req: LLMRequest) {
  return generateOpenAICompatible(req, {
    url: 'https://api.together.xyz/v1/chat/completions',
    headers: { Authorization: `Bearer ${req.apiKey}` },
  });
}
