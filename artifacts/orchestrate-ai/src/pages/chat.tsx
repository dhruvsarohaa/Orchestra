import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, Plus, Settings, LogOut, ChevronDown, 
  Send, Image as ImageIcon, Briefcase, BookOpen, Code, 
  Eye, FileText, UserCircle, Lightbulb, Calendar, 
  Target, GraduationCap, TrendingUp, Sparkles, Trash2,
  Menu, X, Brain, Download, Upload
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AGENTS = [
  { id: 'Auto Orchestrator', icon: Sparkles, desc: 'Automatically routes to the best agent' },
  { id: 'Career Agent', icon: Briefcase, desc: 'Resume analysis & career roadmaps' },
  { id: 'Learning Agent', icon: BookOpen, desc: 'Domain roadmaps & resources' },
  { id: 'Code Judge', icon: Code, desc: 'Code evaluation & complexity' },
  { id: 'Vision Agent', icon: Eye, desc: 'Solve visual problems' },
  { id: 'Resume Builder', icon: FileText, desc: 'ATS optimization' },
  { id: 'Interview Prep', icon: UserCircle, desc: 'Mock questions & STAR answers' },
  { id: 'Project Ideas', icon: Lightbulb, desc: 'Innovative ideas & tech stack' },
  { id: 'Study Planner', icon: Calendar, desc: 'Personalized schedules' },
  { id: 'Skill Gap Analyzer', icon: Target, desc: 'Skills vs industry requirements' },
  { id: 'Competitive Exam', icon: GraduationCap, desc: 'Exam roadmaps' },
  { id: 'Progress Tracker', icon: TrendingUp, desc: 'History & insights' },
];

const MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Groq)', provider: 'groq' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', provider: 'groq' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenRouter)', provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', provider: 'openrouter' },
];

type MemoryEntry = {
  role: 'user' | 'assistant';
  message: string;
  agent: string;
  timestamp: number;
};

const GLOBAL_MEMORY_KEY = 'orchestrate_memory_global';

const getMemoryKey = (agentName: string) => `orchestrate_memory_${agentName}`;

const readAgentMemory = (agentName: string): MemoryEntry[] => {
  try {
    const raw = localStorage.getItem(getMemoryKey(agentName));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAgentMemory = (agentName: string, entries: MemoryEntry[]) => {
  localStorage.setItem(getMemoryKey(agentName), JSON.stringify(entries.slice(-30)));
};

const readGlobalSummary = () => localStorage.getItem(GLOBAL_MEMORY_KEY) || '';

const updateGlobalSummary = (message: string) => {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return;
  const lower = cleaned.toLowerCase();
  const looksUseful =
    lower.includes('my name is') ||
    lower.includes('i am ') ||
    lower.includes("i'm ") ||
    lower.includes('i want') ||
    lower.includes('my goal') ||
    lower.includes('goal is') ||
    lower.includes('skills') ||
    lower.includes('learning') ||
    lower.includes('career') ||
    lower.includes('project');
  if (!looksUseful) return;
  const existing = readGlobalSummary();
  const fact = cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
  const parts = existing ? existing.split(' | ').filter(Boolean) : [];
  if (!parts.some(part => part.toLowerCase() === fact.toLowerCase())) {
    parts.push(fact);
  }
  localStorage.setItem(GLOBAL_MEMORY_KEY, parts.slice(-6).join(' | ').slice(0, 500));
};

const saveAgentMemory = (agentName: string, role: 'user' | 'assistant', message: string) => {
  const entry: MemoryEntry = { role, message, agent: agentName, timestamp: Date.now() };
  writeAgentMemory(agentName, [...readAgentMemory(agentName), entry]);
  if (role === 'user') {
    updateGlobalSummary(message);
  }
};

const buildPromptWithMemory = (agentName: string, currentMessage: string, basePrompt: string) => {
  const previous = readAgentMemory(agentName)
    .slice(-10)
    .map(entry => `${entry.role}: ${entry.message}`)
    .join('\n');
  const globalSummary = readGlobalSummary();
  const memorySections = [
    globalSummary ? `User summary:\n${globalSummary}` : '',
    previous ? `Previous conversation:\n${previous}` : '',
    `Current message: ${currentMessage}`,
  ].filter(Boolean).join('\n\n');
  return `${memorySections}\n\n${basePrompt}`;
};

export default function Chat() {
  const { 
    conversations, currentConversationId, createConversation, setCurrentConversation,
    selectedModel, setSelectedModel, selectedAgent, setSelectedAgent,
    addMessage, logout, apiKeyGemini, apiKeyGroq, apiKeyOpenRouter,
    setApiKeyGemini, setApiKeyGroq, setApiKeyOpenRouter, deleteConversation
  } = useAppStore();

  const [input, setInput] = useState('');
  const [imageAttachment, setImageAttachment] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMemoryRef = useRef<HTMLInputElement>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const memoryCounts = AGENTS.reduce<Record<string, number>>((acc, agent) => {
    acc[agent.id] = readAgentMemory(agent.id).length;
    return acc;
  }, {});
  const totalMemoryMessages = Object.values(memoryCounts).reduce((sum, count) => sum + count, 0);
  const globalSummary = readGlobalSummary();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, isTyping]);

  const callGemini = async (prompt: string, key: string, modelId: string, image?: { mimeType: string; data: string } | null) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: image ? [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] : [{ text: prompt }] }]
      })
    });
    if (!res.ok) throw new Error('Gemini API Error');
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  };

  const callGroq = async (prompt: string, key: string, modelId: string) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error('Groq API Error');
    const data = await res.json();
    return data.choices[0].message.content;
  };

  const callOpenRouter = async (prompt: string, key: string, modelId: string) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'OrchestrateAI'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error('OpenRouter API Error');
    const data = await res.json();
    return data.choices[0].message.content;
  };

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

  const refreshMemory = () => setMemoryVersion(version => version + 1);

  const exportMemory = () => {
    const payload = {
      global: readGlobalSummary(),
      agents: AGENTS.reduce<Record<string, MemoryEntry[]>>((acc, agent) => {
        acc[agent.id] = readAgentMemory(agent.id);
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
        if (typeof parsed.global === 'string') {
          localStorage.setItem(GLOBAL_MEMORY_KEY, parsed.global.slice(0, 500));
        }
        if (parsed.agents && typeof parsed.agents === 'object') {
          Object.entries(parsed.agents).forEach(([agentName, entries]) => {
            if (Array.isArray(entries)) {
              const safeEntries = entries
                .filter(entry => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.message === 'string')
                .map(entry => ({
                  role: entry.role,
                  message: entry.message,
                  agent: typeof entry.agent === 'string' ? entry.agent : agentName,
                  timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
                }));
              writeAgentMemory(agentName, safeEntries);
            }
          });
        }
        refreshMemory();
      } catch {
        window.alert('Could not import memory. Please choose a valid orchestrate_memory.json file.');
      } finally {
        if (importMemoryRef.current) {
          importMemoryRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const clearAllMemory = () => {
    AGENTS.forEach(agent => localStorage.removeItem(getMemoryKey(agent.id)));
    localStorage.removeItem(GLOBAL_MEMORY_KEY);
    refreshMemory();
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageAttachment) || isTyping) return;

    let convId = currentConversationId;
    if (!convId) {
      convId = createConversation();
    }

    const userMsg = input.trim();
    setInput('');
    const imageForRequest = imageAttachment;
    setImageAttachment(null);
    const userMemoryMessage = imageForRequest ? `${userMsg || 'Analyze this image'}\n\nAttached image: ${imageForRequest.name}` : userMsg;
    addMessage(convId, { role: 'user', content: userMemoryMessage });
    saveAgentMemory(selectedAgent, 'user', userMemoryMessage);
    refreshMemory();
    setIsTyping(true);

    try {
      const modelInfo = MODELS.find(m => m.id === selectedModel);
      let responseText = "";

      const basePrompt = `You are acting as the ${selectedAgent} within OrchestrateAI. Provide a helpful, precise, and professional response to the user's query.${imageForRequest ? '\nIf an image is attached, analyze it carefully and include relevant visual observations.' : ''}\n\nUser: ${userMsg || 'Analyze the attached image.'}`;
      const systemPrompt = buildPromptWithMemory(selectedAgent, userMsg || 'Analyze the attached image.', basePrompt);

      if (modelInfo?.provider === 'google') {
        if (!apiKeyGemini) {
          responseText = `Please add your Gemini API key in settings to use ${modelInfo.name}.`;
        } else {
          responseText = await callGemini(systemPrompt, apiKeyGemini, modelInfo.id, imageForRequest);
        }
      } else if (modelInfo?.provider === 'groq') {
        if (imageForRequest) {
          responseText = 'Image analysis is available with Gemini models. Switch the Model Engine to Gemini and add your Gemini API key for multimodal requests.';
        } else if (!apiKeyGroq) {
          responseText = `Please add your Groq API key in settings to use ${modelInfo.name}.`;
        } else {
          responseText = await callGroq(systemPrompt, apiKeyGroq, modelInfo.id);
        }
      } else if (modelInfo?.provider === 'openrouter') {
        if (!apiKeyOpenRouter) {
          responseText = `Please add your OpenRouter API key in settings to use ${modelInfo.name}.`;
        } else if (imageForRequest) {
          responseText = 'This OpenRouter profile is configured for text requests in this demo. Use Gemini for image analysis.';
        } else {
          responseText = await callOpenRouter(systemPrompt, apiKeyOpenRouter, modelInfo.id);
        }
      } else {
        responseText = "Selected model provider is not supported yet.";
      }

      addMessage(convId!, { role: 'assistant', content: responseText, agent: selectedAgent });
      saveAgentMemory(selectedAgent, 'assistant', responseText);
      refreshMemory();
    } catch (err: any) {
      const errorMessage = `Error processing request: ${err.message}. Please check your API keys and try again.`;
      addMessage(convId!, { role: 'assistant', content: errorMessage, agent: 'System' });
    } finally {
      setIsTyping(false);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-white flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          OrchestrateAI
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="px-3 pb-3">
        <Button onClick={() => { setCurrentConversation(createConversation()); setIsSidebarOpen(false); }} className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-white border-0" variant="outline">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {conversations.map(conv => (
            <div key={conv.id} className={`group flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${currentConversationId === conv.id ? 'bg-primary/20 text-primary-foreground' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`} onClick={() => { setCurrentConversation(conv.id); setIsSidebarOpen(false); }}>
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{conv.title}</span>
              </div>
              <Trash2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }} />
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 mt-auto">
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-white/10">
            <DialogHeader>
              <DialogTitle>Configuration</DialogTitle>
              <DialogDescription>Manage your API keys and preferences.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gemini API Key</label>
                <Input type="password" value={apiKeyGemini} onChange={e => setApiKeyGemini(e.target.value)} placeholder="AIzaSy..." className="bg-black/20 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Groq API Key</label>
                <Input type="password" value={apiKeyGroq} onChange={e => setApiKeyGroq(e.target.value)} placeholder="gsk_..." className="bg-black/20 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">OpenRouter API Key</label>
                <Input type="password" value={apiKeyOpenRouter} onChange={e => setApiKeyOpenRouter(e.target.value)} placeholder="sk-or-v1..." className="bg-black/20 border-white/10" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" onClick={logout} className="w-full justify-start gap-2 text-muted-foreground hover:text-red-400">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 w-64 border-r border-white/5 bg-card/95 backdrop-blur-xl flex flex-col z-50 transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 z-10 bg-background/80 backdrop-blur-sm sticky top-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden mr-1" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 font-medium text-sm">
                  {MODELS.find(m => m.id === selectedModel)?.name}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card border-white/10">
                <DropdownMenuLabel>Select Model Engine</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {MODELS.map(m => (
                  <DropdownMenuItem key={m.id} onClick={() => setSelectedModel(m.id)} className="cursor-pointer">
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white/5 border-white/10 text-sm">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Memory</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-card border-white/10 text-foreground sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Local Memory</SheetTitle>
                  <SheetDescription>Stored only in this browser.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm text-muted-foreground">Total messages remembered</div>
                    <div className="mt-1 text-3xl font-semibold text-white">{totalMemoryMessages}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">Per-agent memory</div>
                    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                      {AGENTS.map(agent => (
                        <div key={agent.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full ${memoryCounts[agent.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            <span className="truncate">{agent.id}</span>
                          </div>
                          <span className="text-muted-foreground">{memoryCounts[agent.id] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-medium text-white">Global user summary</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{globalSummary || 'No global facts remembered yet.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-2 bg-white/5 border-white/10" onClick={exportMemory}>
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                    <Button variant="outline" className="gap-2 bg-white/5 border-white/10" onClick={() => importMemoryRef.current?.click()}>
                      <Upload className="w-4 h-4" />
                      Import
                    </Button>
                  </div>
                  <input ref={importMemoryRef} type="file" accept="application/json,.json" className="hidden" onChange={e => importMemory(e.target.files?.[0] || null)} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full border-red-500/20 bg-red-500/10 text-red-300 hover:text-red-200">
                        Clear All Memory
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all local memory?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes every remembered message and the global user summary from this browser.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-500 text-white hover:bg-red-500/90" onClick={clearAllMemory}>Clear Memory</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white/5 border-white/10 text-sm">
                  {React.createElement(AGENTS.find(a => a.id === selectedAgent)?.icon || Sparkles, { className: "w-4 h-4 text-primary" })}
                  <span className="hidden sm:inline">{selectedAgent}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-card border-white/10 max-h-[400px] overflow-y-auto">
                <DropdownMenuLabel>Select Agent</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {AGENTS.map(a => (
                  <DropdownMenuItem key={a.id} onClick={() => setSelectedAgent(a.id)} className="cursor-pointer flex flex-col items-start py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <span className={`h-2 w-2 rounded-full ${memoryCounts[a.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      <a.icon className="w-4 h-4 text-primary" />
                      {a.id}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{a.desc}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 z-10 scroll-smooth" ref={scrollRef}>
          {!currentConversation?.messages.length ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
              <div className="space-y-4 mt-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-4xl font-semibold tracking-tight text-white">How can I help you today?</h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">OrchestrateAI is your command center for career, exams, and projects.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
                {AGENTS.slice(1, 7).map(agent => (
                  <button key={agent.id} onClick={() => { setSelectedAgent(agent.id); }} className="flex flex-col text-left p-4 rounded-xl border border-white/5 bg-card hover:bg-white/5 transition-all group shadow-sm">
                    <div className="flex items-center justify-between gap-2 font-medium text-foreground group-hover:text-primary transition-colors">
                      <span className="flex items-center gap-2 min-w-0">
                        <agent.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{agent.id}</span>
                      </span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${memoryCounts[agent.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{agent.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-6">
              {currentConversation.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto rounded-tr-sm' : 'bg-card border border-white/5 text-foreground mr-auto rounded-tl-sm'}`}>
                    {msg.role === 'assistant' && msg.agent && (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary mb-2 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        {msg.agent}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-card border border-white/5 text-foreground px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background/80 backdrop-blur-md border-t border-white/5 sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto relative">
            {imageAttachment && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-card px-3 py-2 text-sm text-muted-foreground">
                <span className="truncate">Attached image: {imageAttachment.name}</span>
                <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-foreground" onClick={() => setImageAttachment(null)}>
                  Remove
                </Button>
              </div>
            )}
            <div className="relative bg-card border border-white/10 rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all flex items-end">
              <div className="p-2 pb-2.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null)} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
              <Textarea 
                value={input}
                onChange={e => setInput(e.target.value)}
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
                <Button size="icon" className={`h-8 w-8 shrink-0 rounded-lg transition-colors ${input.trim() || imageAttachment ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`} onClick={handleSend} disabled={(!input.trim() && !imageAttachment) || isTyping}>
                  <Send className="w-4 h-4" />
                </Button>
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