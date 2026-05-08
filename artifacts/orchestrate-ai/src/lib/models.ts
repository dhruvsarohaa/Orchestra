import type { ProviderId } from './streaming';

export type ModelDef = { id: string; name: string; provider: ProviderId };

export const MODELS: ModelDef[] = [
  { id: 'gemini-1.5-flash-latest',                     name: 'Gemini 1.5 Flash',        provider: 'google' },
  { id: 'gemini-1.5-pro',                              name: 'Gemini 1.5 Pro',          provider: 'google' },
  { id: 'gemini-2.0-flash',                            name: 'Gemini 2.0 Flash',        provider: 'google' },
  { id: 'llama-3.3-70b-versatile',                     name: 'Llama 3.3 70B',           provider: 'groq' },
  { id: 'llama-3.1-8b-instant',                        name: 'Llama 3.1 8B Instant',    provider: 'groq' },
  { id: 'claude-3-5-sonnet-20241022',                  name: 'Claude 3.5 Sonnet',       provider: 'anthropic' },
  { id: 'claude-3-haiku-20240307',                     name: 'Claude 3 Haiku',          provider: 'anthropic' },
  { id: 'openai/gpt-4o-mini',                          name: 'GPT-4o Mini',             provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet',                 name: 'Claude 3.5 (OpenRouter)', provider: 'openrouter' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',     name: 'Llama 3.3 70B Turbo',    provider: 'together' },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',        name: 'Mixtral 8x7B',            provider: 'together' },
];

export const PROVIDERS: Record<ProviderId, { label: string; badge: string; dot: string }> = {
  google:     { label: 'Google',     badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',          dot: 'bg-sky-400' },
  groq:       { label: 'Groq',       badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400' },
  anthropic:  { label: 'Anthropic',  badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',    dot: 'bg-amber-400' },
  openrouter: { label: 'OpenRouter', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  together:   { label: 'Together',   badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',        dot: 'bg-pink-400' },
};
