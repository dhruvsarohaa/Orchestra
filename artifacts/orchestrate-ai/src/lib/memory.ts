export type FactCategory = 'identity' | 'goals' | 'context';

export type Profile = {
  identity: string[];
  goals: string[];
  context: string[];
};

const PROFILE_KEY = 'orchestrate_profile_v2';
const RECENT_KEY = (agent: string) => `orchestrate_recent_${agent}`;
const SUMMARY_KEY = (agent: string) => `orchestrate_summary_${agent}`;
const LEGACY_GLOBAL = 'orchestrate_memory_global';

const MAX_PER_CATEGORY = 8;
const MAX_RECENT = 8;
const SUMMARIZE_AT = 12;

const emptyProfile = (): Profile => ({ identity: [], goals: [], context: [] });

export function readProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        identity: Array.isArray(parsed.identity) ? parsed.identity : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        context: Array.isArray(parsed.context) ? parsed.context : [],
      };
    }
    const legacy = localStorage.getItem(LEGACY_GLOBAL);
    if (legacy) {
      return { identity: [], goals: [], context: legacy.split(' | ').filter(Boolean).slice(0, MAX_PER_CATEGORY) };
    }
  } catch {}
  return emptyProfile();
}

export function writeProfile(p: Profile) {
  const trimmed: Profile = {
    identity: p.identity.slice(-MAX_PER_CATEGORY),
    goals: p.goals.slice(-MAX_PER_CATEGORY),
    context: p.context.slice(-MAX_PER_CATEGORY),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(trimmed));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(LEGACY_GLOBAL);
}

function dedupePush(arr: string[], item: string): string[] {
  const cleaned = item.replace(/\s+/g, ' ').trim();
  if (!cleaned) return arr;
  const lower = cleaned.toLowerCase();
  const filtered = arr.filter(x => x.toLowerCase() !== lower);
  filtered.push(cleaned.length > 120 ? cleaned.slice(0, 117) + '...' : cleaned);
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

const IDENTITY_PATTERNS: RegExp[] = [
  /\bmy name is\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){0,2})/i,
  /\bi['’]?m\s+([A-Z][\w'-]+)\b(?!\s+(?:looking|trying|going|interested|working|studying|learning|building|preparing))/,
  /\bi am\s+([A-Z][\w'-]+)\b(?!\s+(?:looking|trying|going|interested|working|studying|learning|building|preparing))/,
  /\bi['’]?m\s+a\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi am\s+a\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi['’]?m\s+studying\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi am\s+studying\s+([\w\s-]{3,40}?)(?:[.,!?]|$)/i,
  /\bi['’]?m\s+in\s+(?:my\s+)?([\w\s-]{3,30}?\s+(?:year|semester|grade))/i,
];

const GOAL_PATTERNS: RegExp[] = [
  /\bmy goal is\s+([^.!?\n]{5,140})/i,
  /\bgoal is to\s+([^.!?\n]{5,140})/i,
  /\bi want to\s+([^.!?\n]{5,140})/i,
  /\bi['’]?d like to\s+([^.!?\n]{5,140})/i,
  /\bi['’]?m preparing for\s+([^.!?\n]{3,100})/i,
  /\bi am preparing for\s+([^.!?\n]{3,100})/i,
  /\bi want a\s+([^.!?\n]{5,100})/i,
  /\bi['’]?m aiming for\s+([^.!?\n]{3,100})/i,
  /\bplan(?:ning)? to\s+([^.!?\n]{5,140})/i,
];

const CONTEXT_PATTERNS: RegExp[] = [
  /\bi['’]?m (?:learning|studying|working on|building)\s+([^.!?\n]{3,140})/i,
  /\bi am (?:learning|studying|working on|building)\s+([^.!?\n]{3,140})/i,
  /\bi (?:like|love|prefer|enjoy)\s+([^.!?\n]{3,100})/i,
  /\bi (?:use|know|have experience with)\s+([^.!?\n]{3,100})/i,
  /\bmy (?:tech stack|stack) is\s+([^.!?\n]{3,140})/i,
  /\bi['’]?m interested in\s+([^.!?\n]{3,140})/i,
];

export function heuristicExtractFacts(text: string): Partial<Profile> {
  const out: Partial<Profile> = { identity: [], goals: [], context: [] };
  const tryPatterns = (patterns: RegExp[], cat: FactCategory, prefix?: string) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const value = m[1].trim().replace(/[.,;:!?]+$/, '');
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
        ? v.map(x => String(x).trim()).filter(x => x.length >= 2 && x.length <= 200)
        : [];
    return { identity: norm(parsed.identity), goals: norm(parsed.goals), context: norm(parsed.context) };
  } catch {
    return null;
  }
}

export const FACTS_EXTRACTION_PROMPT = (text: string) =>
  `Extract personal facts from this user message. Return ONLY valid JSON with three string arrays: identity (name, role, who they are), goals (what they want to achieve), context (what they're working on, learning, or care about). Keep each fact ≤ 100 characters. If a category has nothing, return an empty array. NO markdown, NO explanation.

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
  items.push({ role, message, ts: Date.now() });
  writeRecent(agent, items);
}

export function readSummary(agent: string): string {
  return localStorage.getItem(SUMMARY_KEY(agent)) || '';
}

export function writeSummary(agent: string, summary: string) {
  if (summary.trim()) localStorage.setItem(SUMMARY_KEY(agent), summary.trim().slice(0, 600));
}

export function clearAgentMemory(agent: string) {
  localStorage.removeItem(RECENT_KEY(agent));
  localStorage.removeItem(SUMMARY_KEY(agent));
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

  const sections = [
    profileBits.length ? `User profile:\n${profileBits.join('\n')}` : '',
    summary ? `Older conversation summary:\n${summary}` : '',
    recentBlock ? `Recent conversation (last ${recent.length} messages):\n${recentBlock}` : '',
    `Current message: ${userMessage}`,
  ].filter(Boolean).join('\n\n');

  return `${sections}\n\n${basePrompt}`;
}

export const SUMMARIZATION_PROMPT = (existing: string, transcript: string) =>
  `${existing ? `Existing memory summary:\n${existing}\n\n` : ''}Compress the following older conversation into a concise memory summary of 2-3 sentences MAX. Capture goals, key facts, and what was discussed. Plain text only, no markdown.\n\nConversation:\n${transcript}`;

export { MAX_RECENT, SUMMARIZE_AT };
