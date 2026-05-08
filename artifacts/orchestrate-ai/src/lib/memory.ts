export type FactCategory = 'identity' | 'goals' | 'context';
export type MemoryCategory =
  | FactCategory
  | 'preference'
  | 'project'
  | 'skill'
  | 'constraint'
  | 'workflow';
export type MemoryScope = 'global' | 'agent' | 'session';
export type MemorySource = 'heuristic' | 'ai' | 'manual' | 'conversation' | 'import';

export type Profile = {
  identity: string[];
  goals: string[];
  context: string[];
};

export type MemoryItem = {
  id: string;
  text: string;
  category: MemoryCategory;
  scope: MemoryScope;
  agentId?: string;
  importance: number;
  tags: string[];
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
};

export type MemoryExport = {
  version: 3;
  profile: Profile;
  memories: MemoryItem[];
  agents: Record<string, { recent: RecentMessage[]; summary: string }>;
  exportedAt: string;
};

const PROFILE_KEY = 'orchestrate_profile_v2';
const MEMORY_KEY = 'orchestrate_memory_items_v3';
const RECENT_KEY = (agent: string) => `orchestrate_recent_${agent}`;
const SUMMARY_KEY = (agent: string) => `orchestrate_summary_${agent}`;
const LEGACY_GLOBAL = 'orchestrate_memory_global';

const MAX_PER_CATEGORY = 12;
const MAX_RECENT = 8;
const SUMMARIZE_AT = 12;

const emptyProfile = (): Profile => ({ identity: [], goals: [], context: [] });

function now() {
  return Date.now();
}

function uid() {
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanText(item: string): string {
  return item.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function normalize(item: string): string {
  return cleanText(item).toLowerCase();
}

function clampImportance(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function inferImportance(text: string, category: MemoryCategory): number {
  const lower = text.toLowerCase();
  if (category === 'identity') return 5;
  if (category === 'goals') return 4;
  if (/\b(deadline|exam|interview|urgent|must|need|target|goal)\b/.test(lower)) return 4;
  if (/\b(prefer|avoid|always|never|remember)\b/.test(lower)) return 4;
  return 3;
}

function inferTags(text: string, category: MemoryCategory): string[] {
  const common = ['react', 'java', 'python', 'dsa', 'resume', 'career', 'interview', 'gate', 'jee', 'ai', 'project'];
  const lower = text.toLowerCase();
  const tags = common.filter(tag => lower.includes(tag));
  return Array.from(new Set([category, ...tags])).slice(0, 6);
}

function isMemoryItem(value: unknown): value is MemoryItem {
  const item = value as Partial<MemoryItem>;
  return !!item && typeof item.id === 'string' && typeof item.text === 'string';
}

function readStoredProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        identity: Array.isArray(parsed.identity) ? parsed.identity.map(String).filter(Boolean) : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals.map(String).filter(Boolean) : [],
        context: Array.isArray(parsed.context) ? parsed.context.map(String).filter(Boolean) : [],
      };
    }
    const legacy = localStorage.getItem(LEGACY_GLOBAL);
    if (legacy) {
      return { identity: [], goals: [], context: legacy.split(' | ').filter(Boolean).slice(0, MAX_PER_CATEGORY) };
    }
  } catch {}
  return emptyProfile();
}

function readStoredMemoryItems(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMemoryItem).map(item => ({
      id: item.id,
      text: cleanText(item.text),
      category: item.category || 'context',
      scope: item.scope || 'global',
      agentId: item.agentId,
      importance: clampImportance(item.importance || inferImportance(item.text, item.category || 'context')),
      tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : inferTags(item.text, item.category || 'context'),
      source: item.source || 'import',
      createdAt: Number(item.createdAt) || now(),
      updatedAt: Number(item.updatedAt) || Number(item.createdAt) || now(),
      lastAccessedAt: item.lastAccessedAt,
    }));
  } catch {
    return [];
  }
}

function writeMemoryItems(items: MemoryItem[]) {
  const deduped: MemoryItem[] = [];
  const seen = new Set<string>();
  items
    .filter(item => cleanText(item.text))
    .sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt)
    .forEach(item => {
      const key = [normalize(item.text), item.category, item.scope, item.agentId || ''].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push({ ...item, text: cleanText(item.text), importance: clampImportance(item.importance) });
    });
  localStorage.setItem(MEMORY_KEY, JSON.stringify(deduped.slice(0, 250)));
}

function profileFromItems(items: MemoryItem[]): Profile {
  const next = emptyProfile();
  (['identity', 'goals', 'context'] as FactCategory[]).forEach(category => {
    next[category] = items
      .filter(item => item.scope === 'global' && item.category === category)
      .sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt)
      .map(item => item.text)
      .slice(0, MAX_PER_CATEGORY);
  });
  return next;
}

function migrateLegacyProfileIfNeeded(): MemoryItem[] {
  const existing = readStoredMemoryItems();
  if (existing.length) return existing;
  const profile = readStoredProfile();
  const seed: MemoryItem[] = [];
  (['identity', 'goals', 'context'] as FactCategory[]).forEach(category => {
    profile[category].forEach(text => {
      const cleaned = cleanText(text);
      if (!cleaned) return;
      seed.push({
        id: uid(),
        text: cleaned,
        category,
        scope: 'global',
        importance: inferImportance(cleaned, category),
        tags: inferTags(cleaned, category),
        source: 'import',
        createdAt: now(),
        updatedAt: now(),
      });
    });
  });
  if (seed.length) writeMemoryItems(seed);
  return seed;
}

function syncProfileItems(profile: Profile) {
  const items = readStoredMemoryItems();
  const next = [...items];
  (['identity', 'goals', 'context'] as FactCategory[]).forEach(category => {
    profile[category].forEach(text => {
      const cleaned = cleanText(text);
      if (!cleaned) return;
      const exists = next.some(item =>
        item.scope === 'global' &&
        item.category === category &&
        normalize(item.text) === normalize(cleaned)
      );
      if (!exists) {
        next.push({
          id: uid(),
          text: cleaned,
          category,
          scope: 'global',
          importance: inferImportance(cleaned, category),
          tags: inferTags(cleaned, category),
          source: 'heuristic',
          createdAt: now(),
          updatedAt: now(),
        });
      }
    });
  });
  writeMemoryItems(next);
}

export function readProfile(): Profile {
  const stored = readStoredProfile();
  const fromItems = profileFromItems(migrateLegacyProfileIfNeeded());
  return {
    identity: fromItems.identity.length ? fromItems.identity : stored.identity.slice(0, MAX_PER_CATEGORY),
    goals: fromItems.goals.length ? fromItems.goals : stored.goals.slice(0, MAX_PER_CATEGORY),
    context: fromItems.context.length ? fromItems.context : stored.context.slice(0, MAX_PER_CATEGORY),
  };
}

export function writeProfile(p: Profile) {
  const trimmed: Profile = {
    identity: p.identity.map(cleanText).filter(Boolean).slice(-MAX_PER_CATEGORY),
    goals: p.goals.map(cleanText).filter(Boolean).slice(-MAX_PER_CATEGORY),
    context: p.context.map(cleanText).filter(Boolean).slice(-MAX_PER_CATEGORY),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(trimmed));
  syncProfileItems(trimmed);
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(LEGACY_GLOBAL);
  localStorage.removeItem(MEMORY_KEY);
}

function dedupePush(arr: string[], item: string): string[] {
  const cleaned = cleanText(item);
  if (!cleaned) return arr;
  const lower = cleaned.toLowerCase();
  const filtered = arr.filter(x => x.toLowerCase() !== lower);
  filtered.push(cleaned);
  return filtered.slice(-MAX_PER_CATEGORY);
}

export function addFacts(profile: Profile, facts: Partial<Profile>): Profile {
  const next: Profile = {
    identity: [...profile.identity],
    goals: [...profile.goals],
    context: [...profile.context],
  };
  (facts.identity || []).forEach(f => { next.identity = dedupePush(next.identity, f); });
  (facts.goals || []).forEach(f => { next.goals = dedupePush(next.goals, f); });
  (facts.context || []).forEach(f => { next.context = dedupePush(next.context, f); });
  return next;
}

export function readMemoryItems(filters: {
  query?: string;
  scope?: MemoryScope;
  agentId?: string;
  category?: MemoryCategory;
} = {}): MemoryItem[] {
  const q = filters.query?.trim().toLowerCase();
  return migrateLegacyProfileIfNeeded()
    .filter(item => !filters.scope || item.scope === filters.scope)
    .filter(item => !filters.agentId || item.agentId === filters.agentId)
    .filter(item => !filters.category || item.category === filters.category)
    .filter(item => !q || item.text.toLowerCase().includes(q) || item.tags.some(tag => tag.toLowerCase().includes(q)))
    .sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt);
}

export function upsertMemoryItem(input: Partial<MemoryItem> & { text: string }): MemoryItem {
  const cleaned = cleanText(input.text);
  const category = input.category || 'context';
  const scope = input.scope || 'global';
  const items = readStoredMemoryItems();
  const existing = items.find(item =>
    item.id === input.id ||
    (normalize(item.text) === normalize(cleaned) &&
      item.category === category &&
      item.scope === scope &&
      (item.agentId || '') === (input.agentId || ''))
  );
  const timestamp = now();
  const item: MemoryItem = {
    id: existing?.id || input.id || uid(),
    text: cleaned,
    category,
    scope,
    agentId: scope === 'agent' ? input.agentId : input.agentId,
    importance: clampImportance(input.importance || existing?.importance || inferImportance(cleaned, category)),
    tags: input.tags || existing?.tags || inferTags(cleaned, category),
    source: input.source || existing?.source || 'manual',
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
    lastAccessedAt: input.lastAccessedAt || existing?.lastAccessedAt,
  };
  writeMemoryItems([item, ...items.filter(x => x.id !== item.id)]);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileFromItems(readStoredMemoryItems())));
  return item;
}

export function updateMemoryItem(id: string, patch: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): MemoryItem | null {
  const items = readStoredMemoryItems();
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return null;
  const next = {
    ...items[idx],
    ...patch,
    text: patch.text ? cleanText(patch.text) : items[idx].text,
    importance: patch.importance ? clampImportance(patch.importance) : items[idx].importance,
    tags: patch.tags || inferTags(patch.text || items[idx].text, patch.category || items[idx].category),
    updatedAt: now(),
  };
  items[idx] = next;
  writeMemoryItems(items);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileFromItems(readStoredMemoryItems())));
  return next;
}

export function deleteMemoryItem(id: string) {
  writeMemoryItems(readStoredMemoryItems().filter(item => item.id !== id));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileFromItems(readStoredMemoryItems())));
}

export function importMemoryItems(items: MemoryItem[]) {
  const imported = items.map(item => ({
    ...item,
    id: item.id || uid(),
    text: cleanText(item.text),
    source: 'import' as MemorySource,
    updatedAt: now(),
  }));
  writeMemoryItems([...imported, ...readStoredMemoryItems()]);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileFromItems(readStoredMemoryItems())));
}

export function promoteMemoryItemToShared(id: string): MemoryItem | null {
  return updateMemoryItem(id, { scope: 'global', agentId: undefined });
}

const IDENTITY_PATTERNS: RegExp[] = [
  /\bmy name is\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})/i,
  /\bi['`]?m\s+([A-Z][\w'-]+)\b(?!\s+(?:looking|trying|going|interested|working|studying|learning|building|preparing))/i,
  /\bi am\s+([A-Z][\w'-]+)\b(?!\s+(?:looking|trying|going|interested|working|studying|learning|building|preparing))/i,
  /\bi['`]?m\s+a\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi am\s+a\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi['`]?m\s+studying\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi am\s+studying\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi['`]?m\s+in\s+(?:my\s+)?([\w\s-]{3,30}?\s+(?:year|semester|grade))/i,
];

const GOAL_PATTERNS: RegExp[] = [
  /\bmy goal is\s+([^.!?\n]{5,140})/i,
  /\bgoal is to\s+([^.!?\n]{5,140})/i,
  /\bi want to\s+([^.!?\n]{5,140})/i,
  /\bi['`]?d like to\s+([^.!?\n]{5,140})/i,
  /\bi['`]?m preparing for\s+([^.!?\n]{3,100})/i,
  /\bi am preparing for\s+([^.!?\n]{3,100})/i,
  /\bi want a\s+([^.!?\n]{5,100})/i,
  /\bi['`]?m aiming for\s+([^.!?\n]{3,100})/i,
  /\bplan(?:ning)? to\s+([^.!?\n]{5,140})/i,
];

const CONTEXT_PATTERNS: RegExp[] = [
  /\bi['`]?m (?:learning|studying|working on|building)\s+([^.!?\n]{3,140})/i,
  /\bi am (?:learning|studying|working on|building)\s+([^.!?\n]{3,140})/i,
  /\bi (?:like|love|prefer|enjoy)\s+([^.!?\n]{3,100})/i,
  /\bi (?:use|know|have experience with)\s+([^.!?\n]{3,100})/i,
  /\bmy (?:tech stack|stack) is\s+([^.!?\n]{3,140})/i,
  /\bi['`]?m interested in\s+([^.!?\n]{3,140})/i,
];

export function heuristicExtractFacts(text: string): Partial<Profile> {
  const out: Partial<Profile> = { identity: [], goals: [], context: [] };
  const tryPatterns = (patterns: RegExp[], cat: FactCategory, prefix?: string) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const value = cleanText(m[1].replace(/[.,;:!?]+$/, ''));
        if (value.length >= 2 && value.length <= 140) {
          out[cat]!.push(prefix ? `${prefix} ${value}` : value);
        }
      }
    }
  };
  tryPatterns(IDENTITY_PATTERNS, 'identity');
  tryPatterns(GOAL_PATTERNS, 'goals', 'wants to');
  tryPatterns(CONTEXT_PATTERNS, 'context');
  return out;
}

export function tryParseAiFacts(raw: string): Partial<Profile> | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const norm = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map(x => cleanText(String(x))).filter(x => x.length >= 2 && x.length <= 200)
        : [];
    return { identity: norm(parsed.identity), goals: norm(parsed.goals), context: norm(parsed.context) };
  } catch {
    return null;
  }
}

export const FACTS_EXTRACTION_PROMPT = (text: string) =>
  `Extract durable personal facts from this user message. Return only valid JSON with three string arrays: identity (name, role, who they are), goals (what they want to achieve), context (work, learning, preferences, constraints). Keep each fact under 100 characters. If a category has nothing, return an empty array. No markdown.

Message: ${text}

JSON:`;

export type RecentMessage = { role: 'user' | 'assistant'; message: string; ts: number };

export function readRecent(agent: string): RecentMessage[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY(agent));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeRecent(agent: string, items: RecentMessage[]) {
  localStorage.setItem(RECENT_KEY(agent), JSON.stringify(items.slice(-30)));
}

export function appendRecent(agent: string, role: 'user' | 'assistant', message: string) {
  const items = readRecent(agent);
  items.push({ role, message, ts: now() });
  writeRecent(agent, items);
}

export function readSummary(agent: string): string {
  return localStorage.getItem(SUMMARY_KEY(agent)) || '';
}

export function writeSummary(agent: string, summary: string) {
  if (summary.trim()) localStorage.setItem(SUMMARY_KEY(agent), summary.trim().slice(0, 900));
}

export function clearAgentMemory(agent: string) {
  localStorage.removeItem(RECENT_KEY(agent));
  localStorage.removeItem(SUMMARY_KEY(agent));
  writeMemoryItems(readStoredMemoryItems().filter(item => item.agentId !== agent));
}

export function totalFactCount(profile: Profile): number {
  return profile.identity.length + profile.goals.length + profile.context.length;
}

export function buildPrompt(args: {
  agent: string;
  profile: Profile;
  userMessage: string;
  basePrompt: string;
}): string {
  const { agent, profile, userMessage, basePrompt } = args;
  const recent = readRecent(agent).slice(-MAX_RECENT);
  const recentBlock = recent.map(m => `${m.role}: ${m.message}`).join('\n');
  const summary = readSummary(agent);
  const profileBits: string[] = [];
  if (profile.identity.length) profileBits.push(`Identity: ${profile.identity.join('; ')}`);
  if (profile.goals.length) profileBits.push(`Goals: ${profile.goals.join('; ')}`);
  if (profile.context.length) profileBits.push(`Context: ${profile.context.join('; ')}`);

  const globalMemories = searchMemoryItems(userMessage, 10, { scope: 'global' })
    .map(m => `- [${m.category}, importance ${m.importance}/5] ${m.text}`)
    .join('\n');
  const agentMemories = searchMemoryItems(userMessage, 8, { scope: 'agent', agentId: agent })
    .map(m => `- [${m.category}, importance ${m.importance}/5] ${m.text}`)
    .join('\n');

  const sections = [
    profileBits.length ? `User profile:\n${profileBits.join('\n')}` : '',
    globalMemories ? `Shared long-term memory:\n${globalMemories}` : '',
    agentMemories ? `${agent} private memory:\n${agentMemories}` : '',
    summary ? `Older ${agent} conversation summary:\n${summary}` : '',
    recentBlock ? `Recent ${agent} session context (last ${recent.length} messages):\n${recentBlock}` : '',
    `Current message: ${userMessage}`,
  ].filter(Boolean).join('\n\n');

  return `${sections}\n\n${basePrompt}`;
}

export function searchMemoryItems(
  query: string,
  limit = 8,
  filters: { scope?: MemoryScope; agentId?: string } = {},
): MemoryItem[] {
  const terms = query
    .toLowerCase()
    .split(/[\s,.;:!?]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  const all = readMemoryItems(filters);
  if (!terms.length) return all.slice(0, limit);
  return all
    .map(item => {
      const hay = `${item.text} ${item.tags.join(' ')}`.toLowerCase();
      const termHits = terms.reduce((score, term) => score + (hay.includes(term) ? 1 : 0), 0);
      const recency = Math.max(0, 1 - (Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24 * 30));
      const score = termHits * 2 + item.importance * 0.6 + recency;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);
}

export function composePrompt(args: {
  agent: string;
  profile: Profile;
  userMessage: string;
  basePrompt: string;
  recall?: { topK?: number };
}): string {
  return buildPrompt(args);
}

export const SUMMARIZATION_PROMPT = (existing: string, transcript: string) =>
  `${existing ? `Existing memory summary:\n${existing}\n\n` : ''}Compress the following older conversation into a concise durable memory summary of 2-3 sentences max. Capture goals, preferences, constraints, and decisions. Plain text only, no markdown.\n\nConversation:\n${transcript}`;

export { MAX_RECENT, SUMMARIZE_AT };
