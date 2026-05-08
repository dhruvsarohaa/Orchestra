import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore, type Theme, type Conversation } from '@/lib/store';
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
  User, Flag, BookMarked, KeyRound, Bug, Mail, Rocket, Binary,
  Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, Search,
  Flame, BarChart3, MessageCircle, Star, FileDown, Zap, Pin, PinOff,
  SlidersHorizontal, Database, Shield, Bell, Keyboard, Gauge, Cloud, HardDrive, Save, Pencil,
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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  readProfile, writeProfile, clearProfile,
  appendRecent, readRecent, writeRecent,
  readSummary, writeSummary, clearAgentMemory,
  readMemoryItems, upsertMemoryItem, updateMemoryItem, deleteMemoryItem, importMemoryItems,
  promoteMemoryItemToShared,
  heuristicExtractFacts, tryParseAiFacts, addFacts,
  buildPrompt, FACTS_EXTRACTION_PROMPT, SUMMARIZATION_PROMPT,
  totalFactCount, type Profile, type MemoryItem, type MemoryCategory, type MemoryScope,
  MAX_RECENT, SUMMARIZE_AT,
} from '@/lib/memory';
import {
  streamFor, nonStreamingFallback, type ProviderId,
} from '@/lib/streaming';
import { toast } from '@/hooks/use-toast';
import { AGENTS, AGENT_SYSTEM_PROMPTS, PROMPT_CHIPS } from '@/lib/agents';
import { MODELS, PROVIDERS } from '@/lib/models';
import { routeAgentForMessage } from '@/lib/routing';

const MEMORY_CATEGORIES: MemoryCategory[] = ['identity', 'goals', 'context', 'preference', 'project', 'skill', 'constraint', 'workflow'];

// Code block parser
type ContentPart = { type: 'text'; content: string } | { type: 'code'; content: string; lang: string };

function parseContent(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2].replace(/\n$/, ''), lang: match[1] || 'code' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

// CodeBlock component
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border/60 bg-background/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-foreground/[0.03]">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md hover:bg-foreground/5"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Message content renderer
function MessageContent({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const parts = useMemo(() => parseContent(text), [text]);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <CodeBlock key={i} code={part.content} lang={part.lang} />;
        }
        return (
          <span
            key={i}
            className={`whitespace-pre-wrap${i === parts.length - 1 && isStreaming ? ' streaming-cursor' : ''}`}
          >
            {part.content}
          </span>
        );
      })}
    </>
  );
}

// Sidebar conversation row
type ConvRowProps = {
  conv: Conversation;
  index: number;
  active: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
};

function ConvRow({ conv, index, active, isPinned, onSelect, onDelete, onPin }: ConvRowProps) {
  const agentDef = AGENTS.find(a => a.id === conv.lastAgentId);
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms`, animationFillMode: 'both' }}
      className={`group relative flex items-center justify-between pl-3 pr-1.5 py-2 rounded-md cursor-pointer transition-all duration-200 ease-out animate-in fade-in slide-in-from-left-2
        ${active
          ? 'bg-primary/15 text-foreground shadow-[inset_3px_0_0_0_hsl(var(--primary)),0_4px_18px_-8px_hsl(var(--primary)/0.6)]'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {agentDef ? (
          <span className={`w-2 h-2 rounded-full shrink-0 ${agentDef.iconColor.replace('text-', 'bg-')}`} />
        ) : (
          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : ''}`} />
        )}
        <span className="truncate text-xs">{conv.title}</span>
      </div>
      {/* Action buttons revealed on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 ml-1">
        <button
          title={isPinned ? 'Unpin' : 'Pin to top'}
          onClick={e => { e.stopPropagation(); onPin(); }}
          className={`p-1 rounded hover:bg-foreground/10 transition-colors duration-150 ${isPinned ? 'text-amber-400' : 'text-muted-foreground hover:text-amber-400'}`}
        >
          {isPinned
            ? <PinOff className="w-3 h-3" />
            : <Pin className="w-3 h-3" />}
        </button>
        <button
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-red-400 transition-colors duration-150"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Hero background
function HeroOrbs() {
  return (
    <div className="hero-mesh absolute inset-0 overflow-hidden pointer-events-none" />
  );
}

// Main chat component
export default function Chat() {
  const {
    conversations, currentConversationId, createConversation, setCurrentConversation,
    selectedModel, setSelectedModel, selectedAgent, setSelectedAgent,
    addMessage, updateMessage, updateConversationTitle, rateMessage, logout,
    apiKeyGemini, apiKeyGroq, apiKeyOpenRouter, apiKeyAnthropic, apiKeyTogether,
    setApiKeyGemini, setApiKeyGroq, setApiKeyOpenRouter, setApiKeyAnthropic, setApiKeyTogether,
    deleteConversation, pinConversation, theme, setTheme, streak, recordActivity,
    temperature, setTemperature, tokenLimit, setTokenLimit, reasoningMode, setReasoningMode,
    memoryEnabled, setMemoryEnabled, providerPriority, setProviderPriority,
    fallbackModel, setFallbackModel, localModelsEnabled, setLocalModelsEnabled,
    cloudModelsEnabled, setCloudModelsEnabled, performanceMode, setPerformanceMode,
    privacyMode, setPrivacyMode, notificationsEnabled, setNotificationsEnabled,
    keyboardShortcutsEnabled, setKeyboardShortcutsEnabled, agentPreferences, setAgentPreference,
    importConfiguration,
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
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [retryPayload, setRetryPayload] = useState<{
    userMsg: string; image: typeof imageAttachment; convId: string; agent: string; model: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMemoryRef = useRef<HTMLInputElement>(null);
  const importConfigRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const memoryCounts = useMemo(() => {
    void memVersion;
    return AGENTS.reduce<Record<string, number>>((acc, a) => {
      acc[a.id] = readRecent(a.id).length;
      return acc;
    }, {});
  }, [memVersion]);
  const memoryItems = useMemo(() => {
    void memVersion;
    return readMemoryItems({ query: memorySearch });
  }, [memVersion, memorySearch]);
  const totalRemembered = memoryItems.length + Object.values(memoryCounts).reduce((s, c) => s + c, 0);

  const totalUserMessages = useMemo(
    () => conversations.reduce((s, c) => s + c.messages.filter(m => m.role === 'user').length, 0),
    [conversations],
  );

  const stats = useMemo(() => {
    const totalConvs = conversations.length;
    const totalMsgs = conversations.reduce((s, c) => s + c.messages.length, 0);
    const agentCounts: Record<string, number> = {};
    const agentRatings: Record<string, number> = {};
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        if (msg.agent && msg.role === 'assistant') {
          agentCounts[msg.agent] = (agentCounts[msg.agent] || 0) + 1;
        }
        if (msg.agent && msg.rating === 'up') {
          agentRatings[msg.agent] = (agentRatings[msg.agent] || 0) + 1;
        }
      });
    });
    const mostUsedAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const topRatedAgent = Object.entries(agentRatings).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    return { totalConvs, totalMsgs, mostUsedAgent, topRatedAgent };
  }, [conversations]);

  const { pinnedConvs, unpinnedConvs } = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    const all = q ? conversations.filter(c => c.title.toLowerCase().includes(q)) : conversations;
    return {
      pinnedConvs:   all.filter(c => c.pinned),
      unpinnedConvs: all.filter(c => !c.pinned),
    };
  }, [conversations, sidebarSearch]);

  const refreshMem = () => {
    setProfile(readProfile());
    setMemVersion(v => v + 1);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, isTyping, isStreaming]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!keyboardShortcutsEnabled) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'n') { e.preventDefault(); const id = createConversation(); setCurrentConversation(id); }
      if (mod && e.key === 'k') { e.preventDefault(); setIsAgentMenuOpen(true); }
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsSidebarOpen(false);
        setIsAgentMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [createConversation, setCurrentConversation, keyboardShortcutsEnabled]);

  const apiKeyFor = (p: ProviderId) =>
    p === 'google' ? apiKeyGemini :
    p === 'groq' ? apiKeyGroq :
    p === 'openrouter' ? apiKeyOpenRouter :
    p === 'anthropic' ? apiKeyAnthropic :
    apiKeyTogether;

  const resolveModelForRequest = (requestedModelId: string, agentId: string, hasImage: boolean) => {
    const preferredId = agentPreferences[agentId]?.modelId || requestedModelId;
    const preferred = MODELS.find(m => m.id === preferredId);
    const fallback = MODELS.find(m => m.id === fallbackModel);
    const priorityModel = providerPriority
      .map(provider => MODELS.find(m => m.provider === provider && apiKeyFor(provider)))
      .find(Boolean);
    const candidates = [preferred, fallback, priorityModel].filter(Boolean) as ModelDef[];
    if (hasImage) {
      return candidates.find(m => m.provider === 'google' && apiKeyFor(m.provider)) || MODELS.find(m => m.provider === 'google') || preferred;
    }
    return candidates.find(m => apiKeyFor(m.provider)) || preferred;
  };

  const requestTemperatureFor = (agentId: string) => agentPreferences[agentId]?.temperature ?? temperature;
  const reasoningModeFor = (agentId: string) => agentPreferences[agentId]?.reasoningMode ?? reasoningMode;
  const agentMemoryEnabled = (agentId: string) => agentPreferences[agentId]?.memoryEnabled ?? memoryEnabled;

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

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  const exportConversation = () => {
    if (!currentConversation) return;
    const agentDef = AGENTS.find(a => a.id === selectedAgent);
    const lines = [
      `# ${currentConversation.title}`,
      `**Agent:** ${selectedAgent}`,
      `**Date:** ${new Date(currentConversation.updatedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `**Model:** ${MODELS.find(m => m.id === selectedModel)?.name || selectedModel}`,
      '',
      '---',
      '',
      ...currentConversation.messages.map(m => {
        const role = m.role === 'user' ? '### You' : `### ${m.agent || 'AI'}`;
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
        return `${role}${time ? ` *(${time})*` : ''}\n\n${m.content}\n\n---\n`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentConversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportMemory = () => {
    const payload = {
      version: 3,
      profile: readProfile(),
      memories: readMemoryItems(),
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
        if (Array.isArray(parsed.memories)) importMemoryItems(parsed.memories);
        if (parsed.agents && typeof parsed.agents === 'object') {
          Object.entries(parsed.agents).forEach(([agentName, val]: [string, any]) => {
            if (val && Array.isArray(val.recent)) writeRecent(agentName, val.recent);
            if (val && typeof val.summary === 'string') writeSummary(agentName, val.summary);
          });
        }
        refreshMem();
      } catch {
        toast({ title: 'Import failed', description: 'Could not import memory. Please choose a valid orchestrate_memory.json file.' });
      } finally {
        if (importMemoryRef.current) importMemoryRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const exportConfiguration = () => {
    const payload = {
      version: 1,
      selectedModel,
      selectedAgent,
      theme,
      temperature,
      tokenLimit,
      reasoningMode,
      memoryEnabled,
      providerPriority,
      fallbackModel,
      localModelsEnabled,
      cloudModelsEnabled,
      performanceMode,
      privacyMode,
      notificationsEnabled,
      keyboardShortcutsEnabled,
      agentPreferences,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orchestrate_config.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importConfigurationFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        importConfiguration(parsed);
      } catch {
        toast({ title: 'Import failed', description: 'Could not import configuration. Please choose a valid orchestrate_config.json file.' });
      } finally {
        if (importConfigRef.current) importConfigRef.current.value = '';
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

  const autoGenerateTitle = useCallback(async (convId: string, userMessage: string) => {
    const modelInfo = MODELS.find(m => m.id === selectedModel);
    if (!modelInfo) return;
    const key = apiKeyFor(modelInfo.provider);
    if (!key) return;
    try {
      const title = await nonStreamingFallback(modelInfo.provider, {
        prompt: `Generate a very short 3-5 word title for this chat. Return ONLY the title, no punctuation, no quotes, no explanation.\n\nFirst message: ${userMessage.slice(0, 200)}`,
        modelId: modelInfo.id,
        apiKey: key,
      });
      if (title && title.trim().length > 2) {
        updateConversationTitle(convId, title.trim().slice(0, 50));
      }
    } catch {}
  }, [selectedModel, apiKeyGemini, apiKeyGroq, apiKeyOpenRouter, apiKeyAnthropic, apiKeyTogether, updateConversationTitle]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const doSend = async (userMsg: string, imageForRequest: typeof imageAttachment, convId: string, agentId: string, modelId: string) => {
    const modelInfo = resolveModelForRequest(modelId, agentId, !!imageForRequest);
    if (!modelInfo) {
      addMessage(convId, { role: 'assistant', content: 'No model selected.', agent: 'System' });
      setIsTyping(false);
      return;
    }
    const key = apiKeyFor(modelInfo.provider);
    if (!key) {
      addMessage(convId, {
        role: 'assistant', agent: 'System',
        content: `Please add your ${PROVIDERS[modelInfo.provider].label} API key in Settings to use ${modelInfo.name}.`,
      });
      setIsTyping(false);
      return;
    }
    if (imageForRequest && modelInfo.provider !== 'google') {
      addMessage(convId, {
        role: 'assistant', agent: 'System',
        content: 'Image analysis is only supported with Gemini models. Switch to a Gemini model and add your Gemini API key.',
      });
      setIsTyping(false);
      return;
    }

    const agentPromptSuffix = AGENT_SYSTEM_PROMPTS[agentId]
      ? `\n\n${AGENT_SYSTEM_PROMPTS[agentId]}`
      : '';
    const routingNote = selectedAgent === 'Auto Orchestrator'
      ? `\nYou were selected by Auto Orchestrator through contextual routing. State your specialist angle briefly if it helps, then solve the task.`
      : '';
    const reasoningNote = `\nReasoning mode: ${reasoningModeFor(agentId)}. Performance mode: ${performanceMode}.`;
    const basePrompt = `You are acting as the ${agentId} within OrchestrateAI, a multi-agent AI workspace. Provide a helpful, precise, and professional response.${imageForRequest ? '\nAnalyze any attached image carefully.' : ''}${routingNote}${reasoningNote}${agentPromptSuffix}\n\nUser: ${userMsg || 'Analyze the attached image.'}`;
    const fullPrompt = agentMemoryEnabled(agentId)
      ? buildPrompt({
          agent: agentId,
          profile: readProfile(),
          userMessage: userMsg || 'Analyze the attached image.',
          basePrompt,
        })
      : basePrompt;

    await new Promise(r => setTimeout(r, 800));
    const assistantId = addMessage(convId, { role: 'assistant', content: '', agent: agentId });
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
      temperature: requestTemperatureFor(agentId),
      maxTokens: tokenLimit,
      signal: controller.signal,
      onDelta: (chunk) => {
        accumulated += chunk;
        updateMessage(convId, assistantId, accumulated);
      },
    });

    if (!result.ok) {
      try {
        const fallback = await nonStreamingFallback(modelInfo.provider, {
          prompt: fullPrompt,
          modelId: modelInfo.id,
          apiKey: key,
          image: imageForRequest,
          temperature: requestTemperatureFor(agentId),
          maxTokens: tokenLimit,
          signal: controller.signal,
        });
        accumulated = fallback || '';
        updateMessage(convId, assistantId, accumulated);
      } catch {
        const friendly = 'Something went wrong. Please try a different model or check your API key in Settings.';
        updateMessage(convId, assistantId, friendly, true);
        setRetryPayload({ userMsg, image: imageForRequest, convId, agent: agentId, model: modelId });
        setIsStreaming(false);
        abortRef.current = null;
        return;
      }
    }

    if (accumulated.trim() && agentMemoryEnabled(agentId)) {
      appendRecent(agentId, 'assistant', accumulated);
    }
    setIsStreaming(false);
    abortRef.current = null;
    refreshMem();
    if (readRecent(agentId).length >= SUMMARIZE_AT) {
      summarizeOldMemory(agentId).catch(() => {});
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageAttachment) || isTyping || isStreaming) return;
    let convId = currentConversationId;
    const isFirstMessage = !convId || !conversations.find(c => c.id === convId)?.messages.length;
    if (!convId) convId = createConversation();

    const userMsg = input.trim();
    setInput('');
    const imageForRequest = imageAttachment;
    setImageAttachment(null);
    setRetryPayload(null);
    const memMessage = imageForRequest ? `${userMsg || 'Analyze this image'}\n\nAttached: ${imageForRequest.name}` : userMsg;
    const routedAgent = routeAgentForMessage(selectedAgent, {
      text: memMessage,
      hasImage: !!imageForRequest,
      recentAgent: currentConversation?.lastAgentId,
      availableProviders: providerPriority,
      recentMemoryHits: [],
    });

    addMessage(convId, { role: 'user', content: memMessage });
    if (agentMemoryEnabled(routedAgent)) {
      appendRecent(routedAgent, 'user', memMessage);
      upsertMemoryItem({
        text: memMessage.length > 180 ? memMessage.slice(0, 177) + '...' : memMessage,
        category: 'context',
        scope: 'session',
        agentId: routedAgent,
        importance: 2,
        source: 'conversation',
      });
      refreshMem();
    }
    recordActivity();
    if (memoryEnabled) updateProfileFromMessage(memMessage).catch(() => {});
    if (isFirstMessage || conversations.find(c => c.id === convId)?.messages.length === 0) {
      autoGenerateTitle(convId, userMsg).catch(() => {});
    }
    setIsTyping(true);
    await doSend(userMsg, imageForRequest, convId, routedAgent, selectedModel);
  };

  const handleRetry = async () => {
    if (!retryPayload) return;
    setRetryPayload(null);
    setIsTyping(true);
    await doSend(retryPayload.userMsg, retryPayload.image, retryPayload.convId, retryPayload.agent, retryPayload.model);
  };

  const testConnection = async (provider: ProviderId) => {
    const key = apiKeyFor(provider);
    if (!key) return;
    setTestStatus(s => ({ ...s, [provider]: 'testing' }));
    const testModel = MODELS.find(m => m.provider === provider)!.id;
    try {
      const out = await nonStreamingFallback(provider, { prompt: 'Reply with just the word: ok', modelId: testModel, apiKey: key });
      setTestStatus(s => ({ ...s, [provider]: out ? 'ok' : 'fail' }));
    } catch {
      setTestStatus(s => ({ ...s, [provider]: 'fail' }));
    }
  };

  const apiKeySetters: Record<ProviderId, (k: string) => void> = {
    google: setApiKeyGemini, groq: setApiKeyGroq, openrouter: setApiKeyOpenRouter,
    anthropic: setApiKeyAnthropic, together: setApiKeyTogether,
  };
  const apiKeyValues: Record<ProviderId, string> = {
    google: apiKeyGemini, groq: apiKeyGroq, openrouter: apiKeyOpenRouter,
    anthropic: apiKeyAnthropic, together: apiKeyTogether,
  };
  const apiKeyPlaceholders: Record<ProviderId, string> = {
    google: 'AIzaSy...', groq: 'gsk_...', openrouter: 'sk-or-v1...', anthropic: 'sk-ant-...', together: 'tgp_...',
  };

  // Sidebar
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

      <div className="px-3 pb-3 space-y-2">
        <Button
          onClick={() => { setCurrentConversation(createConversation()); setIsSidebarOpen(false); }}
          className="w-full justify-start gap-2 btn-gradient-primary text-white border-0 shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          New Chat <span className="ml-auto text-white/50 text-[10px] hidden sm:block">Ctrl+N</span>
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
            placeholder="Search chats..."
            className="pl-8 h-8 text-xs bg-foreground/5 border-border/60 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-2">

          {/* Pinned section */}
          {pinnedConvs.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                <Pin className="w-3 h-3 text-amber-400/80" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">Pinned</span>
              </div>
              {pinnedConvs.map((conv, i) => (
                <ConvRow
                  key={conv.id}
                  conv={conv}
                  index={i}
                  active={currentConversationId === conv.id}
                  onSelect={() => { setCurrentConversation(conv.id); setIsSidebarOpen(false); }}
                  onDelete={() => deleteConversation(conv.id)}
                  onPin={() => pinConversation(conv.id, false)}
                  isPinned
                />
              ))}
              {unpinnedConvs.length > 0 && (
                <div className="my-2 border-t border-border/40" />
              )}
            </div>
          )}

          {/* Recents section */}
          {pinnedConvs.length > 0 && unpinnedConvs.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
              <MessageSquare className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Recent</span>
            </div>
          )}

          {unpinnedConvs.map((conv, i) => (
            <ConvRow
              key={conv.id}
              conv={conv}
              index={i}
              active={currentConversationId === conv.id}
              onSelect={() => { setCurrentConversation(conv.id); setIsSidebarOpen(false); }}
              onDelete={() => deleteConversation(conv.id)}
              onPin={() => pinConversation(conv.id, true)}
              isPinned={false}
            />
          ))}

          {pinnedConvs.length === 0 && unpinnedConvs.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-6 text-center">
              {sidebarSearch ? 'No chats found' : 'No conversations yet'}
            </div>
          )}
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
          <DialogContent className="sm:max-w-[760px] glass-card max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                AI Control Center
              </DialogTitle>
              <DialogDescription>Models, agent behavior, memory, privacy, and provider routing.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="keys" className="mt-2">
              <TabsList className="w-full bg-foreground/5 grid grid-cols-3 sm:grid-cols-8 h-auto">
                <TabsTrigger value="keys" className="text-xs"><KeyRound className="w-3.5 h-3.5 mr-1.5" />Keys</TabsTrigger>
                <TabsTrigger value="models" className="text-xs"><SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />Models</TabsTrigger>
                <TabsTrigger value="agents" className="text-xs"><Wand2 className="w-3.5 h-3.5 mr-1.5" />Agents</TabsTrigger>
                <TabsTrigger value="memory" className="text-xs"><Database className="w-3.5 h-3.5 mr-1.5" />Memory</TabsTrigger>
                <TabsTrigger value="appearance" className="text-xs"><Sun className="w-3.5 h-3.5 mr-1.5" />Theme</TabsTrigger>
                <TabsTrigger value="stats" className="text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Stats</TabsTrigger>
                <TabsTrigger value="keyboard" className="text-xs"><Keyboard className="w-3.5 h-3.5 mr-1.5" />Keyboard</TabsTrigger>
                <TabsTrigger value="developer" className="text-xs"><Code className="w-3.5 h-3.5 mr-1.5" />Dev</TabsTrigger>
              </TabsList>

              <TabsContent value="appearance" className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'dark' as Theme, label: 'Dark', icon: Moon },
                    { v: 'light' as Theme, label: 'Light', icon: Sun },
                    { v: 'system' as Theme, label: 'System', icon: Monitor },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setTheme(opt.v)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all duration-200 hover:scale-[1.02]
                        ${theme === opt.v
                          ? 'border-primary/60 bg-primary/10 text-foreground shadow-md shadow-primary/20'
                          : 'border-border/60 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:border-border'}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="models" className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Default model</label>
                    <select aria-label="Default model" value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      {MODELS.map(m => <option key={m.id} value={m.id}>{m.name} - {PROVIDERS[m.provider].label}</option>)}
                    </select>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Fallback model</label>
                    <select aria-label="Fallback model" value={fallbackModel} onChange={e => setFallbackModel(e.target.value)} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      {MODELS.map(m => <option key={m.id} value={m.id}>{m.name} - {PROVIDERS[m.provider].label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                    <div className="flex items-center justify-between text-sm"><span>Temperature</span><span className="text-primary">{temperature.toFixed(1)}</span></div>
                    <input aria-label="Temperature" type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-full mt-3 accent-violet-500" />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                    <div className="flex items-center justify-between text-sm"><span>Token limit</span><span className="text-primary">{tokenLimit}</span></div>
                    <input aria-label="Token limit" type="range" min="512" max="8192" step="256" value={tokenLimit} onChange={e => setTokenLimit(Number(e.target.value))} className="w-full mt-3 accent-violet-500" />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2">
                    <label className="text-sm">Reasoning mode</label>
                    <select aria-label="Reasoning mode" value={reasoningMode} onChange={e => setReasoningMode(e.target.value as any)} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      <option value="fast">Fast</option>
                      <option value="balanced">Balanced</option>
                      <option value="deep">Deep</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Provider priority routing</div>
                  <div className="grid sm:grid-cols-5 gap-2">
                    {providerPriority.map((provider, index) => (
                      <button
                        key={provider}
                        onClick={() => {
                          const next = [...providerPriority];
                          if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          setProviderPriority(next);
                        }}
                        className="rounded-lg border border-border/60 bg-background/50 px-2 py-2 text-xs hover:border-primary/40 transition-colors"
                        title="Click to move earlier"
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${PROVIDERS[provider].dot}`} />
                        {index + 1}. {PROVIDERS[provider].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: Cloud, label: 'Cloud models', value: cloudModelsEnabled, set: setCloudModelsEnabled },
                    { icon: HardDrive, label: 'Local model lane', value: localModelsEnabled, set: setLocalModelsEnabled },
                  ].map(item => (
                    <button key={item.label} onClick={() => item.set(!item.value)} className={`rounded-xl border p-3 text-left transition-all ${item.value ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-foreground/[0.02]'}`}>
                      <item.icon className="w-4 h-4 text-primary mb-2" />
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.value ? 'Enabled' : 'Disabled'}</div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="agents" className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  {AGENTS.map(agent => {
                    const pref = agentPreferences[agent.id] || {};
                    return (
                      <div key={agent.id} className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <agent.icon className={`w-4 h-4 ${agent.iconColor}`} />
                          <div className="text-sm font-semibold">{agent.id}</div>
                        </div>
                        <select aria-label={`${agent.id} model`} value={pref.modelId || ''} onChange={e => setAgentPreference(agent.id, { modelId: e.target.value || undefined })} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs">
                          <option value="">Use default model</option>
                          {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <div className="flex items-center justify-between text-xs">
                          <span>Agent temperature</span>
                          <span>{(pref.temperature ?? temperature).toFixed(1)}</span>
                        </div>
                        <input aria-label={`${agent.id} temperature`} type="range" min="0" max="2" step="0.1" value={pref.temperature ?? temperature} onChange={e => setAgentPreference(agent.id, { temperature: Number(e.target.value) })} className="w-full accent-violet-500" />
                        <button onClick={() => setAgentPreference(agent.id, { memoryEnabled: !(pref.memoryEnabled ?? true) })} className={`w-full rounded-lg border px-3 py-2 text-xs ${pref.memoryEnabled === false ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                          {(pref.memoryEnabled ?? true) ? 'Memory enabled' : 'Memory disabled'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="memory" className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: Database, label: 'Persistent memory', value: memoryEnabled, set: setMemoryEnabled },
                    { icon: Shield, label: 'Privacy mode', value: privacyMode, set: setPrivacyMode },
                    { icon: Bell, label: 'Notifications', value: notificationsEnabled, set: setNotificationsEnabled },
                    { icon: Keyboard, label: 'Keyboard shortcuts', value: keyboardShortcutsEnabled, set: setKeyboardShortcutsEnabled },
                  ].map(item => (
                    <button key={item.label} onClick={() => item.set(!item.value)} className={`rounded-xl border p-3 text-left transition-all ${item.value ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-foreground/[0.02]'}`}>
                      <item.icon className="w-4 h-4 text-primary mb-2" />
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.value ? 'Enabled' : 'Disabled'}</div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2">
                  <label className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Performance mode</label>
                  <select aria-label="Performance mode" value={performanceMode} onChange={e => setPerformanceMode(e.target.value as any)} className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm">
                    <option value="quality">Quality</option>
                    <option value="balanced">Balanced</option>
                    <option value="speed">Speed</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2" onClick={exportConfiguration}><Download className="w-4 h-4" />Export config</Button>
                  <Button variant="outline" className="gap-2" onClick={() => importConfigRef.current?.click()}><Upload className="w-4 h-4" />Import config</Button>
                </div>
                <input aria-label="Import configuration file" ref={importConfigRef} type="file" accept="application/json,.json" className="hidden" onChange={e => importConfigurationFile(e.target.files?.[0] || null)} />
              </TabsContent>

              <TabsContent value="keys" className="mt-4 space-y-3">
                {(Object.keys(PROVIDERS) as ProviderId[]).map(p => {
                  const meta = PROVIDERS[p];
                  const value = apiKeyValues[p] || '';
                  const status = testStatus[p];
                  const saved = value.trim().length > 0;
                  return (
                    <div key={p} className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-border">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${meta.dot} animate-pulse-dot`} />
                          {meta.label} API Key
                        </label>
                        <div className="flex items-center gap-1.5">
                          {saved && status !== 'fail' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
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
                          variant="outline" size="sm"
                          disabled={!saved || status === 'testing'}
                          onClick={() => testConnection(p)}
                          className="shrink-0 text-xs h-9 transition-all duration-200 hover:scale-105"
                        >
                          {status === 'testing' ? 'Testing...' : 'Test'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: MessageCircle, label: 'Total Conversations', value: stats.totalConvs, color: 'text-violet-300', bg: 'bg-violet-500/15' },
                    { icon: MessageSquare, label: 'Total Messages', value: stats.totalMsgs, color: 'text-sky-300', bg: 'bg-sky-500/15' },
                    { icon: Zap, label: 'Most Used Agent', value: stats.mostUsedAgent, color: 'text-amber-300', bg: 'bg-amber-500/15' },
                    { icon: Star, label: 'Top Rated Agent', value: stats.topRatedAgent, color: 'text-yellow-300', bg: 'bg-yellow-500/15' },
                    { icon: Flame, label: 'Day Streak', value: `${streak} day${streak !== 1 ? 's' : ''}`, color: 'text-orange-300', bg: 'bg-orange-500/15' },
                    { icon: Code, label: 'Favorite Model', value: MODELS.find(m => m.id === selectedModel)?.name || selectedModel, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 flex flex-col gap-2">
                      <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                      </div>
                      <div className="text-lg font-bold text-foreground truncate">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="keyboard" className="mt-4 space-y-3">
                <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Active shortcuts</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>New chat</span><span className="text-muted-foreground">Ctrl+N</span></div>
                    <div className="flex justify-between"><span>Agent picker</span><span className="text-muted-foreground">Ctrl+K</span></div>
                    <div className="flex justify-between"><span>Close overlays</span><span className="text-muted-foreground">Esc</span></div>
                    <div className="flex justify-between"><span>Send message</span><span className="text-muted-foreground">Enter</span></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="developer" className="mt-4 space-y-3">
                <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Runtime diagnostics</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>Conversations: {stats.totalConvs}</div>
                    <div>Messages: {stats.totalMsgs}</div>
                    <div>Profile facts: {totalFactCount(profile)}</div>
                    <div>Memory records: {memoryItems.length}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Local storage keys</div>
                  <div className="text-xs text-muted-foreground break-all">
                    {Object.keys(localStorage).join(', ') || 'No keys present'}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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

  // Memory sub-components
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
        Start chatting and I'll remember important things about you.
      </p>
    </div>
  );
  const MemorySection = ({ icon: Icon, title, items, accent }: { icon: any; title: string; items: string[]; accent: string }) => (
    <div className="rounded-xl glass-card p-4 transition-all duration-200 hover:border-primary/30">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="ml-auto text-xs text-muted-foreground">{items.length}</div>
      </div>
      {items.length === 0
        ? <p className="text-xs text-muted-foreground italic">Nothing remembered yet.</p>
        : <div className="flex flex-wrap gap-1.5">{items.map((item, i) => <FactChip key={i} text={item} />)}</div>
      }
    </div>
  );
  const MemoryRecordCard = ({ item }: { item: MemoryItem }) => {
    const draft = editingMemory?.id === item.id ? editingMemory : null;
    const agentLabel = item.agentId || (item.scope === 'global' ? 'Shared' : 'Session');
    return (
      <div className="rounded-xl border border-border/60 bg-foreground/[0.025] p-3 space-y-2">
        {draft ? (
          <>
            <Textarea
              value={draft.text}
              onChange={e => setEditingMemory({ ...draft, text: e.target.value })}
              className="min-h-[72px] bg-background/60 border-border/60 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Memory category"
                value={draft.category}
                onChange={e => setEditingMemory({ ...draft, category: e.target.value as MemoryCategory })}
                className="rounded-lg border border-border/60 bg-background/70 px-2 py-2 text-xs"
              >
                {MEMORY_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select
                aria-label="Memory scope"
                value={draft.scope}
                onChange={e => setEditingMemory({ ...draft, scope: e.target.value as MemoryScope })}
                className="rounded-lg border border-border/60 bg-background/70 px-2 py-2 text-xs"
              >
                <option value="global">Shared</option>
                <option value="agent">Agent private</option>
                <option value="session">Session</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Importance</span>
              <input
                aria-label="Memory importance"
                type="range"
                min="1"
                max="5"
                value={draft.importance}
                onChange={e => setEditingMemory({ ...draft, importance: Number(e.target.value) })}
                className="flex-1 accent-violet-500"
              />
              <span>{draft.importance}/5</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 btn-gradient-primary text-white" onClick={() => {
                updateMemoryItem(item.id, draft);
                setEditingMemory(null);
                refreshMem();
              }}>
                <Save className="w-3.5 h-3.5" />Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingMemory(null)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed text-foreground/90">{item.text}</p>
              <div className="flex gap-1 shrink-0">
                <button title="Edit memory" className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground" onClick={() => setEditingMemory(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button title="Delete memory" className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-300" onClick={() => { deleteMemoryItem(item.id); refreshMem(); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {item.scope === 'agent' && (
                  <button
                    title="Promote to shared"
                    className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-300"
                    onClick={() => { promoteMemoryItemToShared(item.id); refreshMem(); }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded-full border border-border/60 px-2 py-0.5">{item.category}</span>
              <span className="rounded-full border border-border/60 px-2 py-0.5">{agentLabel}</span>
              <span className="rounded-full border border-border/60 px-2 py-0.5">Importance {item.importance}/5</span>
              <span className="ml-auto">{new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  const currentModel = MODELS.find(m => m.id === selectedModel);
  const currentAgent = AGENTS.find(a => a.id === selectedAgent);
  const chips = PROMPT_CHIPS[selectedAgent] || PROMPT_CHIPS['Auto Orchestrator'];

  // Render
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 w-64 border-r border-border/60 bg-sidebar/95 backdrop-blur-xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header */}
        <header className="h-14 border-b border-border/60 flex items-center justify-between px-3 sm:px-4 z-10 bg-background/70 backdrop-blur-md sticky top-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 font-medium text-sm transition-all duration-200 hover:bg-foreground/5 max-w-[180px] sm:max-w-none">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PROVIDERS[currentModel?.provider || 'google'].dot}`} />
                  <span className="truncate">{currentModel?.name}</span>
                  <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
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
                          className="cursor-pointer flex items-center justify-between gap-2"
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
            {/* Memory button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 bg-foreground/5 border-border/60 text-sm transition-all duration-200 ease-out hover:scale-105 hover:border-primary/40 hover:shadow-md hover:shadow-primary/20">
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
                  <SheetTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-primary" />Your Memory</SheetTitle>
                  <SheetDescription>Editable local memory with shared, agent-private, and session scopes.</SheetDescription>
                </SheetHeader>
                <div className="relative mt-5">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={memorySearch}
                    onChange={e => setMemorySearch(e.target.value)}
                    placeholder="Search memories, tags, agents..."
                    className="pl-8 h-9 text-xs bg-foreground/5 border-border/60 focus-visible:ring-primary/30"
                  />
                </div>
                {totalFactCount(profile) === 0 && totalRemembered === 0 ? <MemoryEmpty /> : (
                  <div className="mt-6 space-y-4">
                    <MemorySection icon={User}      title="Who you are"    items={profile.identity} accent="bg-sky-500/15 text-sky-300" />
                    <MemorySection icon={Flag}      title="Your goals"     items={profile.goals}    accent="bg-amber-500/15 text-amber-300" />
                    <MemorySection icon={BookMarked}title="Recent context" items={profile.context}  accent="bg-emerald-500/15 text-emerald-300" />
                    <div className="rounded-xl glass-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memory records</div>
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => {
                          const item = upsertMemoryItem({
                            text: 'New memory',
                            category: 'context',
                            scope: 'global',
                            importance: 3,
                            source: 'manual',
                          });
                          setEditingMemory(item);
                          refreshMem();
                        }}>
                          <Plus className="w-3.5 h-3.5" />Add
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {memoryItems.length
                          ? memoryItems.map(item => <MemoryRecordCard key={item.id} item={item} />)
                          : <p className="text-xs text-muted-foreground text-center py-5">No memory records match your search.</p>
                        }
                      </div>
                    </div>
                    <div className="rounded-xl glass-card p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per-agent activity</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {AGENTS.map(a => (
                          <div key={a.id} className="flex items-center justify-between rounded-md border border-border/40 bg-foreground/[0.02] px-2.5 py-1.5 text-xs">
                            <span className="flex items-center gap-1.5 min-w-0 truncate">
                              {memoryCounts[a.id] > 0
                                ? <span className={`w-1.5 h-1.5 rounded-full ${a.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                                : <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                              }
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
                  <Button variant="outline" className="gap-2 transition-all duration-200 hover:scale-105" onClick={exportMemory}>
                    <Download className="w-4 h-4" /> Export
                  </Button>
                  <Button variant="outline" className="gap-2 transition-all duration-200 hover:scale-105" onClick={() => importMemoryRef.current?.click()}>
                    <Upload className="w-4 h-4" /> Import
                  </Button>
                </div>
                <input aria-label="Import memory file" ref={importMemoryRef} type="file" accept="application/json,.json" className="hidden" onChange={e => importMemory(e.target.files?.[0] || null)} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="mt-2 w-full border-red-500/30 bg-red-500/10 text-red-300 hover:text-red-200 hover:bg-red-500/15">
                      Clear All Memory
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all local memory?</AlertDialogTitle>
                      <AlertDialogDescription>This wipes all profile data and conversation history from this browser.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-500 text-white hover:bg-red-500/90" onClick={clearAllMemory}>Clear Memory</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SheetContent>
            </Sheet>

            {/* Agent selector */}
            <DropdownMenu open={isAgentMenuOpen} onOpenChange={setIsAgentMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-foreground/5 border-border/60 text-sm transition-all duration-200 ease-out hover:scale-105 hover:border-primary/40 hover:shadow-md hover:shadow-primary/20">
                  {currentAgent && React.createElement(currentAgent.icon, { className: `w-4 h-4 ${currentAgent.iconColor}` })}
                  <span className="hidden sm:inline truncate max-w-[120px]">{selectedAgent}</span>
                  <span className="text-muted-foreground/40 text-[10px] hidden sm:block">Ctrl+K</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 glass-card max-h-[420px] overflow-y-auto">
                <DropdownMenuLabel>Select Agent</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AGENTS.map(a => (
                  <DropdownMenuItem key={a.id} onClick={() => setSelectedAgent(a.id)} className="cursor-pointer flex flex-col items-start py-2">
                    <div className="flex items-center gap-2 font-medium w-full">
                      {memoryCounts[a.id] > 0
                        ? <span className={`h-2 w-2 rounded-full ${a.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                        : <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      }
                      <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                      <span className="text-sm">{a.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 ml-8">{a.desc}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 z-10 scroll-smooth relative custom-scrollbar" ref={scrollRef}>
          {!currentConversation?.messages.length && <HeroOrbs />}
          {!currentConversation?.messages.length && (
            <div className="animate-hero-gradient absolute inset-0 pointer-events-none opacity-95" />
          )}

          {!currentConversation?.messages.length ? (
            <div className="relative h-full flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-8 pb-10 pt-4">
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out" style={{ animationFillMode: 'both' }}>
                <div className="w-16 h-16 mx-auto mb-4 btn-gradient-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-primary/50">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight shimmer-text">How can I help you today?</h2>
                <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
                  OrchestrateAI - your command center for career, code, and learning.
                </p>
                {totalUserMessages > 0 && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                    <MessageCircle className="w-3.5 h-3.5 text-primary/60" />
                    <span><span className="text-primary font-semibold">{totalUserMessages.toLocaleString()}</span> conversations powered</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 w-full">
                {AGENTS.slice(1).map((agent, i) => {
                  const isActiveAgent = selectedAgent === agent.id;
                  const isGenerating = isActiveAgent && (isTyping || isStreaming);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      style={{ animationDelay: `${120 + i * 50}ms`, animationFillMode: 'both' }}
                      className={`group relative flex flex-col text-left p-3 sm:p-4 rounded-xl border transition-all duration-200 ease-out shadow-sm hover:shadow-lg hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 overflow-hidden
                        ${isActiveAgent
                          ? `border-current ${agent.ring} ring-2 shadow-lg`
                          : 'border-border/60 bg-card/60 hover:border-primary/30'}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} ${isActiveAgent ? 'opacity-90' : 'opacity-40 group-hover:opacity-80'} transition-opacity duration-200 pointer-events-none`} />
                      {isGenerating && (
                        <div className="absolute inset-0 rounded-xl border-2 border-primary/60 animate-pulse pointer-events-none" />
                      )}
                      <div className="relative flex items-start justify-between gap-1 w-full mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <agent.icon className={`w-4 h-4 shrink-0 ${agent.iconColor}`} />
                          <span className={`text-xs font-semibold text-foreground leading-tight ${isActiveAgent ? '' : 'group-hover:text-foreground'}`}>{agent.id}</span>
                        </div>
                        {memoryCounts[agent.id] > 0
                          ? <span className={`w-2 h-2 shrink-0 rounded-full mt-0.5 ${agent.iconColor.replace('text-', 'bg-')} animate-pulse-dot`} />
                          : <span className="w-2 h-2 shrink-0 rounded-full mt-0.5 bg-zinc-600/70" />
                        }
                      </div>
                      <div className="relative text-[11px] text-muted-foreground leading-snug line-clamp-2">{agent.desc}</div>
                      <div className="relative mt-2 flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                        Launch <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 pb-6 animate-in fade-in duration-300">
              {currentConversation.messages.map((msg) => {
                const isStreamingThis = isStreaming &&
                  msg === currentConversation.messages[currentConversation.messages.length - 1] &&
                  msg.role === 'assistant';
                const isFailed = msg.failed;
                const timeStr = msg.timestamp
                  ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div key={msg.id} className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out`}>
                    <div className={`relative max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-sm transition-all duration-200
                      ${msg.role === 'user'
                        ? 'btn-gradient-primary text-white ml-auto rounded-tr-sm'
                        : isFailed
                          ? 'bg-red-500/10 border border-red-500/30 text-foreground mr-auto rounded-tl-sm'
                          : 'bg-card/80 backdrop-blur-sm border border-border/60 text-foreground mr-auto rounded-tl-sm hover:border-border'}`}>

                      {msg.role === 'assistant' && msg.agent && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary mb-2 uppercase tracking-wider">
                          {(() => { const a = AGENTS.find(x => x.id === msg.agent); return a ? React.createElement(a.icon, { className: `w-3.5 h-3.5 ${a.iconColor}` }) : <Wand2 className="w-3.5 h-3.5" />; })()}
                          {msg.agent}
                        </div>
                      )}

                      {msg.role === 'assistant' ? (
                        <MessageContent text={msg.content || (isStreamingThis ? '' : ' ')} isStreaming={isStreamingThis} />
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}

                      {/* Footer: timestamp + actions */}
                      <div className={`flex items-center justify-between mt-2 gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {timeStr && (
                          <span className="text-[10px] opacity-40">{timeStr}</span>
                        )}
                        {msg.role === 'assistant' && !isStreamingThis && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-auto">
                            <button
                              onClick={() => copyMessage(msg.id, msg.content)}
                              className="p-1 rounded-md hover:bg-foreground/10 transition-colors duration-150"
                              title="Copy"
                            >
                              {copiedMsgId === msg.id
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                              }
                            </button>
                            <button
                              onClick={() => rateMessage(currentConversationId!, msg.id, msg.rating === 'up' ? undefined : 'up')}
                              className={`p-1 rounded-md hover:bg-foreground/10 transition-colors duration-150 ${msg.rating === 'up' ? 'text-emerald-400' : 'text-muted-foreground'}`}
                              title="Helpful"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => rateMessage(currentConversationId!, msg.id, msg.rating === 'down' ? undefined : 'down')}
                              className={`p-1 rounded-md hover:bg-foreground/10 transition-colors duration-150 ${msg.rating === 'down' ? 'text-red-400' : 'text-muted-foreground'}`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Retry button for failed messages */}
                      {isFailed && retryPayload && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRetry}
                          className="mt-3 gap-1.5 text-xs border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Try again
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
                  <div className="bg-card/80 backdrop-blur-sm border border-border/60 text-foreground px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                    <span className="text-[11px] font-medium text-primary uppercase tracking-wider mr-1.5 flex items-center gap-1">
                      {currentAgent && React.createElement(currentAgent.icon, { className: `w-3 h-3 ${currentAgent.iconColor}` })}
                      {selectedAgent} is thinking
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

        {/* Input area */}
        <div className="p-3 sm:p-4 bg-background/80 backdrop-blur-md border-t border-border/60 sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto">
            {/* Prompt chips */}
            {!currentConversation?.messages.length && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(chip)}
                    className="px-3 py-1.5 text-xs rounded-full border border-border/60 bg-foreground/[0.03] text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {imageAttachment && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
                <span className="truncate text-xs">Attached: {imageAttachment.name}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0" onClick={() => setImageAttachment(null)}>
                  Remove
                </Button>
              </div>
            )}

            <div className={`relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm flex items-end transition-all duration-300 ${inputFocused ? 'animate-input-glow border-primary/50' : ''}`}>
              <div className="p-2 pb-2.5">
                <input aria-label="Attach image" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null)} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg transition-all duration-200 hover:scale-110" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                ref={inputRef}
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
                className="min-h-[44px] max-h-[160px] w-full resize-none border-0 bg-transparent py-3 px-2 focus-visible:ring-0 text-sm"
                rows={1}
              />
              <div className="flex items-center gap-1 p-2 pb-2.5">
                {currentConversation?.messages.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg transition-all duration-200 hover:scale-110"
                    onClick={exportConversation}
                    title="Export conversation"
                  >
                    <FileDown className="w-4 h-4" />
                  </Button>
                ) : null}
                {isStreaming ? (
                  <Button
                    size="icon"
                    onClick={handleStop}
                    className="h-8 w-8 shrink-0 rounded-lg bg-red-500/90 text-white hover:bg-red-500 transition-all duration-200 ease-out hover:scale-110 hover:shadow-md hover:shadow-red-500/40"
                    aria-label="Stop"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isTyping || (!input.trim() && !imageAttachment)}
                    className={`h-8 w-8 shrink-0 rounded-lg transition-all duration-200 ease-out hover:scale-110
                      ${input.trim() || imageAttachment
                        ? 'btn-gradient-primary text-white shadow-md shadow-primary/30 hover:shadow-primary/50'
                        : 'bg-foreground/5 text-muted-foreground cursor-not-allowed'}`}
                    aria-label="Send"
                  >
                    {isTyping
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </Button>
                )}
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/40 mt-2">Enter to send | Shift+Enter for new line | Ctrl+K for agents | Ctrl+N for new chat</p>
          </div>
        </div>
      </div>
    </div>
  );
}
