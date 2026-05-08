import {
  Briefcase,
  BookOpen,
  Code,
  Eye,
  FileText,
  UserCircle,
  Lightbulb,
  Calendar,
  Target,
  GraduationCap,
  TrendingUp,
  Wand2,
  Bug,
  Mail,
  Rocket,
  Binary,
} from 'lucide-react';
import type React from 'react';

export type AgentDef = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  gradient: string;
  ring: string;
  iconColor: string;
};

export const AGENTS: AgentDef[] = [
  { id: 'Auto Orchestrator', icon: Wand2,        desc: 'Automatically routes to the best agent',              gradient: 'from-violet-500/20 via-blue-500/25 to-transparent',    ring: 'ring-violet-400/30',  iconColor: 'text-violet-300' },
  { id: 'Career Agent',      icon: Briefcase,    desc: 'Resume analysis & career roadmaps',                   gradient: 'from-sky-500/20 via-blue-500/10 to-transparent',       ring: 'ring-sky-400/30',     iconColor: 'text-sky-300' },
  { id: 'Learning Agent',    icon: BookOpen,     desc: 'Domain roadmaps & learning resources',                gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',   ring: 'ring-amber-400/30',   iconColor: 'text-amber-300' },
  { id: 'Code Judge',        icon: Code,         desc: 'Code evaluation & complexity analysis',               gradient: 'from-emerald-500/20 via-green-500/10 to-transparent',  ring: 'ring-emerald-400/30', iconColor: 'text-emerald-300' },
  { id: 'Debug Agent',       icon: Bug,          desc: 'Find bugs, explain causes, get fixed code',           gradient: 'from-red-500/20 via-orange-500/15 to-transparent',     ring: 'ring-red-400/30',     iconColor: 'text-red-300' },
  { id: 'DSA Coach',         icon: Binary,       desc: 'DSA concepts, dry runs, Java code & complexity',      gradient: 'from-green-500/20 via-teal-500/10 to-transparent',     ring: 'ring-green-400/30',   iconColor: 'text-green-300' },
  { id: 'Email Writer',      icon: Mail,         desc: 'Cold emails, LinkedIn messages & follow-ups',         gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',      ring: 'ring-blue-400/30',    iconColor: 'text-blue-300' },
  { id: 'Project Idea Agent',icon: Rocket,       desc: 'Unique project ideas with full tech stack & roadmap', gradient: 'from-purple-500/20 via-fuchsia-500/15 to-transparent', ring: 'ring-purple-400/30',  iconColor: 'text-purple-300' },
  { id: 'Vision Agent',      icon: Eye,          desc: 'Solve visual problems with image analysis',           gradient: 'from-pink-500/20 via-purple-500/10 to-transparent',   ring: 'ring-pink-400/30',    iconColor: 'text-pink-300' },
  { id: 'Resume Builder',    icon: FileText,     desc: 'ATS optimization & resume writing',                   gradient: 'from-cyan-500/20 via-teal-500/10 to-transparent',     ring: 'ring-cyan-400/30',    iconColor: 'text-cyan-300' },
  { id: 'Interview Prep',    icon: UserCircle,   desc: 'Mock questions & STAR method answers',                gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',     ring: 'ring-rose-400/30',    iconColor: 'text-rose-300' },
  { id: 'Project Ideas',     icon: Lightbulb,    desc: 'Innovative ideas & technology stacks',                gradient: 'from-yellow-500/20 via-amber-500/10 to-transparent',  ring: 'ring-yellow-400/30',  iconColor: 'text-yellow-300' },
  { id: 'Study Planner',     icon: Calendar,     desc: 'Personalized study schedules',                        gradient: 'from-indigo-500/20 via-violet-500/10 to-transparent',  ring: 'ring-indigo-400/30',  iconColor: 'text-indigo-300' },
  { id: 'Skill Gap Analyzer',icon: Target,       desc: 'Skills vs industry requirements',                     gradient: 'from-orange-500/20 via-red-500/10 to-transparent',    ring: 'ring-orange-400/30',  iconColor: 'text-orange-300' },
  { id: 'Competitive Exam',  icon: GraduationCap,desc: 'Exam roadmaps & practice problems',                  gradient: 'from-teal-500/20 via-emerald-500/10 to-transparent',  ring: 'ring-teal-400/30',    iconColor: 'text-teal-300' },
  { id: 'Progress Tracker',  icon: TrendingUp,   desc: 'Track history & get insights',                        gradient: 'from-lime-500/20 via-green-500/10 to-transparent',    ring: 'ring-lime-400/30',    iconColor: 'text-lime-300' },
];

export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  'Debug Agent': 'You are a senior developer doing code review. When given code: 1) List ALL bugs with clear explanations of why they occur, 2) Provide the fully corrected code with inline comments explaining each fix. Be thorough and educational.',
  'DSA Coach': 'You are an expert DSA tutor. Always follow this structure: 1) Explain the approach/algorithm, 2) Dry run with a concrete example showing each step, 3) Provide clean Java implementation with comments, 4) State Time Complexity O() and Space Complexity O(). Be clear and educational.',
  'Email Writer': 'You are a professional communication expert. Write concise, impactful outreach messages. For cold emails: strong hook, value proposition, clear CTA, under 150 words. For LinkedIn connection requests: genuine and conversational, under 300 characters. Always adapt tone to context.',
  'Project Idea Agent': 'You are a project ideation expert. Generate unique, buildable project ideas. For each idea provide: 1) Project name & concept, 2) Full tech stack with specific libraries, 3) MVP features (buildable in 1-2 weeks), 4) Advanced features, 5) Why it impresses for a portfolio. Give 2-3 varied options.',
};

export const PROMPT_CHIPS: Record<string, string[]> = {
  'Auto Orchestrator':  ['Help me plan today', 'Give me a challenge', 'What should I focus on?', 'Review my week'],
  'Career Agent':       ['Analyze my resume', 'Give me a career roadmap', 'What skills should I learn?', 'Suggest job titles'],
  'Learning Agent':     ['Create a 30-day roadmap', 'Explain this concept simply', 'Best resources for X', 'Quiz me on this'],
  'Code Judge':         ['Review my code', 'Find the time complexity', 'Optimize this function', 'Explain this code'],
  'Debug Agent':        ['Find bugs in my code', 'Why is this error happening?', 'Fix this function', 'Review this class'],
  'DSA Coach':          ['Explain binary search trees', 'Teach me dynamic programming', "What's the complexity?", 'Solve this problem'],
  'Email Writer':       ['Write a cold recruiter email', 'LinkedIn connection request', 'Follow-up after no reply', 'Improve this message'],
  'Project Idea Agent': ['Portfolio project with React', 'AI-powered app idea', 'Weekend hackathon idea', 'MERN stack project'],
  'Vision Agent':       ['Analyze this image', 'Read this diagram', "What's wrong here?", 'Solve this visual problem'],
  'Resume Builder':     ['Improve my bullet points', 'ATS optimization tips', 'Write a professional summary', 'Format my experience'],
  'Interview Prep':     ['Practice behavioral questions', 'Give me STAR examples', 'SDE interview questions', 'Mock interview me'],
  'Project Ideas':      ['Unique web app ideas', 'Open source project', 'AI integration project', 'Impressive college project'],
  'Study Planner':      ['Create a 30-day study plan', 'Prepare for finals', 'Best study techniques', 'Organize my subjects'],
  'Skill Gap Analyzer': ['Analyze my skills for SDE', 'What am I missing for FAANG?', 'Skills vs job description', 'What to learn next?'],
  'Competitive Exam':   ['JEE study plan', 'Important GATE topics', 'Solve this problem', 'Mock test questions'],
  'Progress Tracker':   ['How am I doing?', 'Set learning milestones', 'Summarize my progress', "What's my weak area?"],
};
