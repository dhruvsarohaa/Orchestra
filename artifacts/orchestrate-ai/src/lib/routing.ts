export type RoutingContext = {
  text: string;
  hasImage: boolean;
  recentAgent?: string;
  availableProviders: string[];
  recentMemoryHits: string[];
};

const ROUTING_RULES: Array<{ agent: string; score: (ctx: RoutingContext) => number }> = [
  { agent: 'Vision Agent', score: (ctx) => (ctx.hasImage ? 100 : 0) },
  { agent: 'Debug Agent', score: (ctx) => (/\b(error|bug|stack trace|exception|crash|fix this|not working)\b/i.test(ctx.text) ? 8 : 0) },
  { agent: 'DSA Coach', score: (ctx) => (/\b(dsa|leetcode|algorithm|complexity|binary tree|dynamic programming|graph|array)\b/i.test(ctx.text) ? 7 : 0) },
  { agent: 'Resume Builder', score: (ctx) => (/\b(resume|cv|ats|bullet point|experience section)\b/i.test(ctx.text) ? 7 : 0) },
  { agent: 'Career Agent', score: (ctx) => (/\b(job|career|internship|role|roadmap|salary|recruiter)\b/i.test(ctx.text) ? 6 : 0) },
  { agent: 'Interview Prep', score: (ctx) => (/\b(interview|mock|behavioral|star method|hr round)\b/i.test(ctx.text) ? 6 : 0) },
  { agent: 'Learning Agent', score: (ctx) => (/\b(learn|teach|explain|course|roadmap|resource|quiz)\b/i.test(ctx.text) ? 5 : 0) },
];

export function routeAgentForMessage(selected: string, ctx: RoutingContext): string {
  if (selected !== 'Auto Orchestrator') return selected;
  const scored = ROUTING_RULES
    .map((rule) => ({ agent: rule.agent, score: rule.score(ctx) + (ctx.recentAgent === rule.agent ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].agent : 'Learning Agent';
}
