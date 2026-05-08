import type { LLMRequest } from '../types';
import { generateOpenAICompatible, streamOpenAICompatible } from './openai-compatible';

export function streamGroq(req: LLMRequest) {
  return streamOpenAICompatible(req, {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${req.apiKey}` },
  });
}

export function generateGroq(req: LLMRequest) {
  return generateOpenAICompatible(req, {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${req.apiKey}` },
  });
}
