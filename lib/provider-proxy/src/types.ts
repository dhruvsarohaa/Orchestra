export type ProviderId = 'google' | 'groq' | 'openrouter' | 'anthropic' | 'together';

export type LLMImage = {
  mimeType: string;
  data: string;
};

export type LLMRequest = {
  provider: ProviderId;
  prompt: string;
  modelId: string;
  apiKey: string;
  image?: LLMImage | null;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type LLMError = {
  code: string;
  message: string;
  status?: number;
};
