import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore, type Theme } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Plus, Settings, LogOut, ChevronDown,
  Send, Image as ImageIcon, Briefcase, BookOpen, Code,
  Eye, FileText, UserCircle, Lightbulb, Calendar,
  Target, GraduationCap, TrendingUp, Wand2, Trash2,
  Menu, X, Brain, Download, Upload, Square, ArrowUpRight,
  CheckCircle2, AlertCircle, Loader2, Sun, Moon, Monitor,
  User, Flag, BookMarked, KeyRound,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader,
  SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  readProfile, writeProfile, clearProfile,
  appendRecent, readRecent, writeRecent,
  readSummary, writeSummary, clearAgentMemory,
  heuristicExtractFacts, tryParseAiFacts, addFacts,
  buildPrompt, FACTS_EXTRACTION_PROMPT, SUMMARIZATION_PROMPT,
  totalFactCount, type Profile,
  MAX_RECENT, SUMMARIZE_AT,
} from '@/lib/memory';
import {
  streamFor, nonStreamingFallback, type ProviderId,
} from '@/lib/streaming';

type AgentDef = {
  id: string;
  icon: React.ComponentType<any>;
  desc: string;
  gradient: string;
  ring: string;
  iconColor: string;
};

const AGENTS: AgentDef[] = [
  { id: 'Auto Orchestrator', icon: Wand2, desc: 'Automatically routes to the best agent', gradient: 'from-violet-500/20 via-blue-500/25 to-transparent', ring: 'ring-violet-400/30', iconColor: 'text-violet-300' },
  { id: 'Career Agent',      icon: Briefcase, desc: 'Resume analysis & career roadmaps',      gradient: 'from-sky-500/20 via-blue-500/10 to-transparent',     ring: 'ring-sky-400/30',     iconColor: 'text-sky-300' },
  { id: 'Learning Agent',    icon: BookOpen, desc: 'Domain roadmaps & resources',             gradient: 'from-amber-500/20 via-orange-500/10 to-transparent', ring: 'ring-amber-400/30',   iconColor: 'text-amber-300' },
  { id: 'Code Judge',        icon: Code, desc: 'Code evaluation & complexity',                gradient: 'from-emerald-500/20 via-green-500/10 to-transparent', ring: 'ring-emerald-400/30', iconColor: 'text-emerald-300' },
  { id: 'Vision Agent',      icon: Eye, desc: 'Solve visual problems',                        gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',  ring: 'ring-purple-400/30',  iconColor: 'text-purple-300' },
  { id: 'Resume Builder',    icon: FileText, desc: 'ATS optimization',                        gradient: 'from-cyan-500/20 via-teal-500/10 to-transparent',    ring: 'ring-cyan-400/30',    iconColor: 'text-cyan-300' },
  { id: 'Interview Prep',    icon: UserCircle, desc: 'Mock questions & STAR answers',         gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',    ring: 'ring-rose-400/30',    iconColor: 'text-rose-300' },
  { id: 'Project Ideas',     icon: Lightbulb, desc: 'Innovative ideas & tech stack',          gradient: 'from-yellow-500/20 via-amber-500/10 to-transparent', ring: 'ring-yellow-400/30',  iconColor: 'text-yellow-300' },
  { id: 'Study Planner',     icon: Calendar, desc: 'Personalized schedules',                  gradient: 'from-indigo-500/20 via-violet-500/10 to-transparent', ring: 'ring-indigo-400/30',  iconColor: 'text-indigo-300' },
  { id: 'Skill Gap Analyzer',icon: Target, desc: 'Skills vs industry requirements',           gradient: 'from-red-500/20 via-orange-500/10 to-transparent',   ring: 'ring-red-400/30',     iconColor: 'text-red-300' },
  { id: 'Competitive Exam',  icon: GraduationCap, desc: 'Exam roadmaps',                      gradient: 'from-teal-500/20 via-emerald-500/10 to-transparent', ring: 'ring-teal-400/30',    iconColor: 'text-teal-300' },
  { id: 'Progress Tracker',  icon: TrendingUp, desc: 'History & insights',                    gradient: 'from-lime-500/20 via-green-500/10 to-transparent',   ring: 'ring-lime-400/30',    iconColor: 'text-lime-300' },
];

type ModelDef = {
  id: string;
  name: string;
  provider: ProviderId;
};

const MODELS: ModelDef[] = [
  { id: 'gemini-1.5-flash',                  name: 'Gemini 1.5 Flash',         provider: 'google' },
  { id: 'gemini-1.5-pro',                    name: 'Gemini 1.5 Pro',           provider: 'google' },
  { id: 'gemini-2.0-flash',                  name: 'Gemini 2.0 Flash',         provider: 'google' },
  { id: 'llama-3.3-70b-versatile',           name: 'Llama 3.3 70B',            provider: 'groq' },
  { id: 'llama-3.1-8b-instant',              name: 'Llama 3.1 8B Instant',     provider: 'groq' },
  { id: 'claude-3-5-sonnet-20241022',        name: 'Claude 3.5 Sonnet',        provider: 'anthropic' },
  { id: 'claude-3-haiku-20240307',           name: 'Claude 3 Haiku',           provider: 'anthropic' },
  { id: 'openai/gpt-4o-mini',                name: 'GPT-4o Mini',              provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet',       name: 'Claude 3.5 (OpenRouter)',  provider: 'openrouter' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', provider: 'together' },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',    name: 'Mixtral 8x7B',         provider: 'together' },
];

const PROVIDERS: Record<ProviderId, { label: string; badge: string; dot: string }> = {
  google:     { label: 'Google',     badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',          dot: 'bg-sky-400' },
  groq:       { label: 'Groq',       badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400' },
  anthropic:  { label: 'Anthropic',  badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',   dot: 'bg-amber-400' },
  openrouter: { label: 'OpenRouter', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  together:   { label: 'Together',   badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',       dot: 'bg-pink-400' },
};

export default function Chat() {
  const {
    conversations, currentConversationId, createConversation, setCurrentConversation,
    selectedModel, setSelectedModel, selectedAgent, setSelectedAgent,
    addMessage, updateMessage, logout,
    apiKeyGemini, apiKeyGroq, apiKeyOpenRouter, apiKeyAnthropic, apiKeyTogether,
    setApiKeyGemini, setApiKeyGroq, setApiKeyOpenRouter, setApiKeyAnthropic, setApiKeyTogether,
    deleteConversation, theme, setTheme,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [imageAttachment, setImageAttachment] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [memVersion, setMemVersion] = useState(0);
  const [profile, setProfile] = useState<Profile>(() => readProfile());
  const [testStatus, setTestStatus] = useState<Record<ProviderId, 'idle' | 'testing' | 'ok' | 'fail'>>({
    google: 'idle', groq: 'idle', openrouter: 'idle', anthropic: 'idle', together: 'idle',
  });
  const [inputFocused, setInputFocused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMemoryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const memoryCounts = useMemo(() => {
    void memVersion;
    return AGENTS.reduce<Record<string, number>>((acc, a) => {
      acc[a.id] = readRecent(a.id).length;
      return acc;
    }, {});
  }, [memVersion]);
  const totalRemembered = Object.values(memoryCounts).reduce((s, c) => s + c, 0);

  const refreshMem = () => {
    setProfile(readProfile());
    setMemVersion(v => v + 1);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, isTyping, isStreaming]);

  const apiKeyFor = (p: ProviderId) =>
    p === 'google' ? apiKeyGemini :
    p === 'groq' ? apiKeyGroq :
    p === 'openrouter' ? apiKeyOpenRouter :
    p === 'anthropic' ? apiKeyAnthropic :
    apiKeyTogether;

  const handleImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const [, base64 = ''] = result.split(',');
      setImageAttachment({ name: file.name, mimeType: file.type || 'image/png', data: base64 });
    };
    reader.readAsDataURL(file);
  };

  const exportMemory = () => {
    const payload = {
      profile: readProfile(),
      agents: AGENTS.reduce<Record<string, { recent: any; summary: string }>>((acc, agent) => {
        acc[agent.id] = { recent: readRecent(agent.id), summary: readSummary(agent.id) };
        return acc;
      }, {}),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orchestrate_memory.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importMemory = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed.profile) writeProfile(parsed.profile);
        if (parsed.agents && typeof parsed.agents === 'object') {
          Object.entries(parsed.agents).forEach(([agentName, val]: [string, any]) => {
            if (val && Array.isArray(val.recent)) writeRecent(agentName, val.recent);
            if (val && typeof val.summary === 'string') writeSummary(agentName, val.summary);
          });
        }
        refreshMem();
      } catch {
        window.alert('Could not import memory. Please choose a valid orchestrate_memory.json file.');
      } finally {
        if (importMemoryRef.current) importMemoryRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const clearAllMemory = () => {
    AGENTS.forEach(a => clearAgentMemory(a.id));
    clearProfile();
    refreshMem();
  };

  const tryAiExtractFacts = async (userMessage: string) => {
    const modelInfo = MODELS.find(m => m.id === selectedModel);
    if (!modelInfo) return null;
    const key = apiKeyFor(modelInfo.provider);
    if (!key) return null;
    try {
      const text = await nonStreamingFallback(modelInfo.provider, {
        prompt: FACTS_EXTRACTION_PROMPT(userMessage),
        modelId: modelInfo.id,
        apiKey: key,
      });
      return tryParseAiFacts(text);
    } catch {
      return null;
    }
  };

  const updateProfileFromMessage = useCallback(async (userMessage: string) => {
    const heur = heuristicExtractFacts(userMessage);
    let merged = addFacts(readProfile(), heur);
    writeProfile(merged);
    refreshMem();

    const ai = await tryAiExtractFacts(userMessage);
    if (ai) {
      merged = addFacts(readProfile(), ai);
      writeProfile(merged);
      refreshMem();
    }
  }, [selectedModel, apiKeyGemini, apiKeyGroq, apiKeyOpenRouter, apiKeyAnthropic, apiKeyTogether]);

  const summarizeOldMemory = useCallback(async (agent: string) => {
    const KEEP = 6;
    const recent = readRecent(agent);
    if (recent.length < SUMMARIZE_AT) return;
    const toCompress = recent.slice(0, recent.length - KEEP);
    const keep = recent.slice(recent.length - KEEP);
    const existing = readSummary(agent);
    const transcript = toCompress.map(m => `${m.role}: ${m.message}`).join('\n').slice(0, 4000);
    const modelInfo = MODELS.find(m => m.id === selectedModel);
    let summary = '';
    try {
      if (modelInfo) {
        const key = apiKeyFor(modelInfo.provider);
        if (key) {
          summary = await nonStreamingFallback(modelInfo.provider, {
            prompt: SUMMARIZATION_PROMPT(existing, transcript),
            modelId: modelInfo.id,
            apiKey: key,
          });
        }
      }
    } catch {}
    if (!summary || summary.length < 10) {
      const userTopics = toCompress.filter(e => e.role === 'user').slice(0, 3).map(e => e.message.slice(0, 80)).join('; ');
      summary = `${existing ? existing + ' ' : ''}Earlier topics: ${userTopics || 'general discussion'}. ${toCompress.length} messages compressed.`;
    }
    writeSummary(agent, summary);
    writeRecent(agent, keep);
    refreshMem();
  }, [selectedModel, apiKeyGemini, apiKeyGroq, apiKeyOpenRouter, apiKeyAnthropic, apiKeyTogether]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageAttachment) || isTyping || isStreaming) return;

    let convId = currentConversationId;
    if (!convId) convId = createConversation();

    const userMsg = input.trim();
    setInput('');
    const imageForRequest = imageAttachment;
    setImageAttachment(null);
    const userMemoryMessage = imageForRequest
      ? `${userMsg || 'Analyze this image'}\n\nAttached image: ${imageForRequest.name}`
      : userMsg;

    addMessage(convId, { role: 'user', content: userMemoryMessage });
    appendRecent(selectedAgent, 'user', userMemoryMessage);
    refreshMem();

    updateProfileFromMessage(userMemoryMessage).catch(() => {});

    setIsTyping(true);

    const modelInfo = MODELS.find(m => m.id === selectedModel);
    if (!modelInfo) {
      addMessage(convId, { role: 'assistant', content: 'No model selected.', agent: 'System' });
      setIsTyping(false);
      return;
    }

    const key = apiKeyFor(modelInfo.provider);
    if (!key) {
      addMessage(convId, {
        role: 'assistant',
        agent: 'System',
        content: `Please add your ${PROVIDERS[modelInfo.provider].label} API key in settings to use ${modelInfo.name}.`,
      });
      setIsTyping(false);
      return;
    }

    if (imageForRequest && modelInfo.provider !== 'google') {
      addMessage(convId, {
        role: 'assistant',
        agent: 'System',
        content: 'Image analysis is only supported with Gemini models. Switch to a Gemini model and add your Gemini API key.',
      });
      setIsTyping(false);
      return;
    }

    const basePrompt = `You are acting as the ${selectedAgent} within OrchestrateAI. Provide a helpful, precise, and professional response to the user's query.${imageForRequest ? '\nIf an image is attached, analyze it carefully and include relevant visual observations.' : ''}\n\nUser: ${userMsg || 'Analyze the attached image.'}`;
    const fullPrompt = buildPrompt({
      agent: selectedAgent,
      profile: readProfile(),
      userMessage: userMsg || 'Analyze the attached image.',
      basePrompt,
    });

    await new Promise(r => setTimeout(r, 800));

    const assistantId = addMessage(convId, { role: 'assistant', content: '', agent: selectedAgent });
    setIsTyping(false);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';

    const result = await streamFor(modelInfo.provider, {
      prompt: fullPrompt,
      modelId: modelInfo.id,
      apiKey: key,
      image: imageForRequest,
      signal: controller.signal,
      onDelta: (chunk) => {
        accumulated += chunk;
        updateMessage(convId!, assistantId, accumulated);
      },
    });

    if (!result.ok) {
      try {
        const fallback = await nonStreamingFallback(modelInfo.provider, {
          prompt: fullPrompt,
          modelId: modelInfo.id,
          apiKey: key,
          image: imageForRequest,
          signal: controller.signal,
        });
        accumulated = fallback || `Error: ${result.error.message}`;
        updateMessage(convId!, assistantId, accumulated);
      } catch (err: any) {
        accumulated = `Error processing request: ${err?.message || result.error.message}. Please check your API key and try again.`;
        updateMessage(convId!, assistantId, accumulated);
      }
    }

    if (accumulated.trim()) {
      appendRecent(selectedAgent, 'assistant', accumulated);
    }

    setIsStreaming(false);
    abortRef.current = null;
    refreshMem();

    if (readRecent(selectedAgent).length >= SUMMARIZE_AT) {
      summarizeOldMemory(selectedAgent).catch(() => {});
    }
  };

  const testConnection = async (provider: ProviderId) => {
    const key = apiKeyFor(provider);
    if (!key) return;
    setTestStatus(s => ({ ...s, [provider]: 'testing' }));
    const testModel = MODELS.find(m => m.provider === provider)!.id;
    try {
      const out = await nonStreamingFallback(provider, {
        prompt: 'Reply with just the word: ok',
        modelId: testModel,
        apiKey: key,
      });
      setTestStatus(s => ({ ...s, [provider]: out ? 'ok' : 'fail' }));
    } catch {
      setTestStatus(s => ({ ...s, [provider]: 'fail' }));
    }
  };

  const apiKeySetters: Record<ProviderId, (k: string) => void> = {
    google: setApiKeyGemini,
    groq: setApiKeyGroq,
    openrouter: setApiKeyOpenRouter,
    anthropic: setApiKeyAnthropic,
    together: setApiKeyTogether,
  };

  const apiKeyValues: Record<ProviderId, string> = {
    google: apiKeyGemini,
    groq: apiKeyGroq,
    openrouter: apiKeyOpenRouter,
    anthropic: apiKeyAnthropic,
    together: apiKeyTogether,
  };

  const apiKeyPlaceholders: Record<ProviderId, string> = {
    google: 'AIzaSy...',
    groq: 'gsk_...',
    openrouter: 'sk-or-v1...',
    anthropic: 'sk-ant-...',
    together: 'tgp_...',
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-foreground flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center btn-gradient-primary shadow-md shadow-primary/30">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          OrchestrateAI
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-3 pb-3">
        <Button
          onClick={() => { setCurrentConversation(createConversation()); setIsSidebarOpen(false); }}
          className="w-full justify-start gap-2 btn-gradient-primary text-white border-0 shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {conversations.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-6 text-center">
              No conversations yet
            </div>
          )}
          {conversations.map((conv, i) => {
            const active = currentConversationId === conv.id;
            return (
              <div
                key={conv.id}
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms`, animationFillMode: 'both' }}
                className={`group relative flex items-center justify-between pl-3 pr-2 py-2 text-sm rounded-md cursor-pointer transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-2 hover:translate-x-0.5
                  ${active
                    ? 'bg-primary/15 text-foreground shadow-[inset_3px_0_0_0_hsl(var(--primary)),0_4px_18px_-8px_hsl(var(--primary)/0.6)]'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`}
                onClick={() => { setCurrentConversation(conv.id); setIsSidebarOpen(false); }}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-primary' : ''}`} />
                  <span className="truncate">{conv.title}</span>
                </div>
                <Trash2
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all duration-300 hover:scale-110"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 mt-auto space-y-1">
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-200">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] glass-card max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configuration
              </DialogTitle>
              <DialogDescription>API keys, models, and appearance.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5" /> Appearance
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'dark' as Theme, label: 'Dark', icon: Moon },
                    { v: 'light' as Theme, label: 'Light', icon: Sun },
                    { v: 'system' as Theme, label: 'System', icon: Monitor },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setTheme(opt.v)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all duration-300 hover:scale-[1.02]
                        ${theme === opt.v
                          ? 'border-primary/60 bg-primary/10 text-foreground shadow-md shadow-primary/20'
                          : 'border-border/60 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-border'}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> API Keys
                </div>
                {(Object.keys(PROVIDERS) as ProviderId[]).map(p => {
                  const meta = PROVIDERS[p];
                  const value = apiKeyValues[p] || '';
                  const status = testStatus[p];
                  const saved = value.trim().length > 0;
                  return (
                    <div key={p} className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2 transition-all duration-300 hover:border-border">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot} animate-pulse-dot`} />
                          {meta.label} API Key
                        </label>
                        <div className="flex items-center gap-1.5">
                          {saved && status !== 'fail' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-label="Saved" />
                          )}
                          {status === 'testing' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                          {status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {status === 'fail' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={value}
                          onChange={e => apiKeySetters[p](e.target.value)}
                          placeholder={apiKeyPlaceholders[p]}
                          className="bg-background/50 border-border/60 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!saved || status === 'testing'}
                          onClick={() => testConnection(p)}
                          className="shrink-0 text-xs h-9 transition-all duration-300 hover:scale-105"
                        >
                          {status === 'testing' ? 'Testing...' : 'Test'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          variant="ghost"
          onClick={logout}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  const FactChip = ({ text }: { text: string }) => (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-primary/10 border border-primary/20 text-foreground/90 transition-all duration-200 hover:bg-primary/15 hover:border-primary/40">
      {text}
    </span>
  );

  const MemoryEmpty = () => (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-14 h-14 rounded-2xl btn-gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-4 animate-pulse-dot">
        <Brain className="w-7 h-7 text-white" />
      </div>
      <div className="text-base font-semibold text-foreground">No memory yet</div>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
        Start chatting and I'll remember important things about you — your name, goals, and what you're working on.
      </p>
    </div>
  );

  const MemorySection = ({ icon: Icon, title, items, accent }: { icon: any; title: string; items: string[]; accent: string }) => (
    <div className="rounded-xl glass-card p-4 transition-all duration-300 hover:border-primary/30">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="ml-auto text-xs text-muted-foreground">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nothing remembered yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => <FactChip key={i} text={item} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className={`fixed md:static inset-y-0 left-0 w-64 border-r border-border/60 bg-sidebar/95 backdrop-blur-xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        <header className="h-14 border-b border-border/60 flex items-center justify-between px-4 z-10 bg-background/70 backdrop-blur-md sticky top-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden mr-1" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 font-medium text-sm transition-all duration-200 hover:bg-foreground/5">
                  <span className={`w-2 h-2 rounded-full ${PROVIDERS[MODELS.find(m => m.id === selectedModel)?.provider || 'google'].dot}`} />
                  {MODELS.find(m => m.id === selectedModel)?.name}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 glass-card max-h-[420px] overflow-y-auto">
                <DropdownMenuLabel>Model Engine</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(PROVIDERS) as ProviderId[]).map(prov => {
                  const provModels = MODELS.filter(m => m.provider === prov);
                  return (
                    <div key={prov}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${PROVIDERS[prov].dot}`} />
                        {PROVIDERS[prov].label}
                      </div>
                      {provModels.map(m => (
                        <DropdownMenuItem
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className="cursor-pointer flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="text-sm">{m.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PROVIDERS[m.provider].badge}`}>
                            {PROVIDERS[m.provider].label}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 bg-foreground/5 border-border/60 text-sm transition-all duration-300 ease-out hover:scale-105 hover:border-primary/40 hover:shadow-md hover:shadow-primary/20">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Memory</span>
                  {totalFactCount(profile) > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary font-medium">
                      {totalFactCount(profile)}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-card/95 backdrop-blur-xl border-border/60 text-foreground sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Your Memory
                  </SheetTitle>
                  <SheetDescription>Stored locally in this browser only.</SheetDescription>
                </SheetHeader>

                {totalFactCount(profile) === 0 && totalRemembered === 0 ? (
                  <MemoryEmpty />
                ) : (
                  <div className="mt-6 space-y-4">
                    <MemorySection
                      icon={User}
                      title="Who you are"
                      items={profile.identity}
                      accent="bg-sky-500/15 text-sky-300"
                    />
                    <MemorySection
                      icon={Flag}
                      title="Your goals"
                      items={profile.goals}
                      accent="bg-amber-500/15 text-amber-300"
                    />
                    <MemorySection
                      icon={BookMarked}
                      title="Recent context"
                      items={profile.context}
                      accent="bg-emerald-500/15 text-emerald-300"
                    />

                    <div className="rounded-xl glass-card p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per-agent activity</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {AGENTS.map(a => (
                          <div key={a.id} className="flex items-center justify-between rounded-md border border-border/40 bg-foreground/[0.02] px-2.5 py-1.5 text-xs">
                            <span className="flex items-center gap-1.5 min-w-0 truncate">
                      {memoryCounts[a.id] > 0 ? (
                        <span className={`w-1.5 h-1.5 rounded-full ${a.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                              )}
                              <span className="truncate">{a.id}</span>
                            </span>
                            <span className="text-muted-foreground">{memoryCounts[a.id] || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2 transition-all duration-300 hover:scale-105" onClick={exportMemory}>
                    <Download className="w-4 h-4" /> Export
                  </Button>
                  <Button variant="outline" className="gap-2 transition-all duration-300 hover:scale-105" onClick={() => importMemoryRef.current?.click()}>
                    <Upload className="w-4 h-4" /> Import
                  </Button>
                </div>
                <input ref={importMemoryRef} type="file" accept="application/json,.json" className="hidden" onChange={e => importMemory(e.target.files?.[0] || null)} />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="mt-2 w-full border-red-500/30 bg-red-500/10 text-red-300 hover:text-red-200 hover:bg-red-500/15">
                      Clear All Memory
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all local memory?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This wipes the user profile and every per-agent recent buffer and summary from this browser.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-500 text-white hover:bg-red-500/90" onClick={clearAllMemory}>Clear Memory</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-foreground/5 border-border/60 text-sm transition-all duration-300 ease-out hover:scale-105 hover:border-primary/40 hover:shadow-md hover:shadow-primary/20">
                  {React.createElement(AGENTS.find(a => a.id === selectedAgent)?.icon || Wand2, {
                    className: `w-4 h-4 ${AGENTS.find(a => a.id === selectedAgent)?.iconColor || 'text-primary'}`,
                  })}
                  <span className="hidden sm:inline">{selectedAgent}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 glass-card max-h-[420px] overflow-y-auto">
                <DropdownMenuLabel>Select Agent</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AGENTS.map(a => (
                  <DropdownMenuItem key={a.id} onClick={() => setSelectedAgent(a.id)} className="cursor-pointer flex flex-col items-start py-2">
                    <div className="flex items-center gap-2 font-medium w-full">
                      {memoryCounts[a.id] > 0 ? (
                        <span className={`h-2 w-2 rounded-full ${a.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      )}
                      <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                      {a.id}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 ml-6">{a.desc}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 z-10 scroll-smooth relative" ref={scrollRef}>
          {!currentConversation?.messages.length ? (
            <div className="absolute inset-0 animate-hero-gradient pointer-events-none opacity-95" />
          ) : null}

          {!currentConversation?.messages.length ? (
            <div className="relative h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-10 pb-10">
              <div
                className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
                style={{ animationFillMode: 'both' }}
              >
                <div className="w-16 h-16 mx-auto mb-6 btn-gradient-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-primary/50">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-semibold tracking-tight shimmer-text">How can I help you today?</h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">OrchestrateAI is your command center for career, exams, and projects.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
                {AGENTS.slice(1, 7).map((agent, i) => (
                  <button
                    key={agent.id}
                    onClick={() => { setSelectedAgent(agent.id); }}
                    style={{ animationDelay: `${150 + i * 80}ms`, animationFillMode: 'both' }}
                    className={`group relative flex flex-col text-left p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-300 ease-out shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 overflow-hidden`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} opacity-50 group-hover:opacity-90 transition-opacity duration-300 pointer-events-none`} />
                    <div className="relative flex items-center justify-between gap-2 font-medium text-foreground group-hover:text-foreground transition-colors duration-300">
                      <span className="flex items-center gap-2 min-w-0">
                        <agent.icon className={`w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ${agent.iconColor}`} />
                        <span className="truncate">{agent.id}</span>
                      </span>
                      {memoryCounts[agent.id] > 0 ? (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${agent.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-600/80" />
                      )}
                    </div>
                    <div className="relative text-xs text-muted-foreground mt-2 line-clamp-2">{agent.desc}</div>
                    <div className="relative mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      Launch
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-6 animate-in fade-in duration-300">
              {currentConversation.messages.map((msg) => {
                const isStreamingThis = isStreaming &&
                  msg === currentConversation.messages[currentConversation.messages.length - 1] &&
                  msg.role === 'assistant';
                return (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out`}>
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm transition-all duration-300
                      ${msg.role === 'user'
                        ? 'btn-gradient-primary text-white ml-auto rounded-tr-sm hover:shadow-md hover:shadow-primary/30'
                        : 'bg-card/80 backdrop-blur-sm border border-border/60 text-foreground mr-auto rounded-tl-sm hover:border-border'}`}>
                      {msg.role === 'assistant' && msg.agent && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary mb-2 uppercase tracking-wider">
                          <Wand2 className="w-3.5 h-3.5" />
                          {msg.agent}
                        </div>
                      )}
                      <div className={`whitespace-pre-wrap ${isStreamingThis ? 'streaming-cursor' : ''}`}>
                        {msg.content || (isStreamingThis ? '' : ' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                  <div className="bg-card/80 backdrop-blur-sm border border-border/60 text-foreground px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                    <span className="text-[11px] font-medium text-primary uppercase tracking-wider mr-1.5 flex items-center gap-1">
                      <Wand2 className="w-3 h-3" /> {selectedAgent} is thinking
                    </span>
                    <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/60 sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto relative">
            {imageAttachment && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
                <span className="truncate">Attached image: {imageAttachment.name}</span>
                <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-foreground" onClick={() => setImageAttachment(null)}>
                  Remove
                </Button>
              </div>
            )}
            <div className={`relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm flex items-end transition-all duration-300 ${inputFocused ? 'animate-input-glow border-primary/50' : ''}`}>
              <div className="p-2 pb-2.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null)} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg transition-all duration-300 hover:scale-110" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${selectedAgent}...`}
                className="min-h-[44px] max-h-[200px] w-full resize-none border-0 bg-transparent py-3 px-2 focus-visible:ring-0 text-sm"
                rows={1}
              />
              <div className="p-2 pb-2.5">
                {isStreaming ? (
                  <Button
                    size="icon"
                    onClick={handleStop}
                    className="h-8 w-8 shrink-0 rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition-all duration-300 ease-out hover:scale-110 hover:shadow-md hover:shadow-red-500/40"
                    aria-label="Stop"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className={`h-8 w-8 shrink-0 rounded-lg transition-all duration-300 ease-out ${
                      input.trim() || imageAttachment
                        ? 'btn-gradient-primary text-white hover:scale-110'
                        : 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
                    }`}
                    onClick={handleSend}
                    disabled={(!input.trim() && !imageAttachment) || isTyping}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="text-center mt-2.5 text-[11px] text-muted-foreground">
              OrchestrateAI is an AI demo. Verify important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
