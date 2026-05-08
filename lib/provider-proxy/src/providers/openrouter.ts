import type { LLMRequest } from '../types';
import { generateOpenAICompatible, streamOpenAICompatible } from './openai-compatible';

export function streamOpenRouter(req: LLMRequest) {
  return streamOpenAICompatible(req, {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'X-Title': 'OrchestrateAI',
    },
  });
}

export function generateOpenRouter(req: LLMRequest) {
  return generateOpenAICompatible(req, {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'X-Title': 'OrchestrateAI',
    },
  });
}
