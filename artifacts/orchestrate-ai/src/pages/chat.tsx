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
  Menu, X
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

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
    addMessage(convId, { role: 'user', content: imageForRequest ? `${userMsg || 'Analyze this image'}\n\nAttached image: ${imageForRequest.name}` : userMsg });
    setIsTyping(true);

    try {
      const modelInfo = MODELS.find(m => m.id === selectedModel);
      let responseText = "";

      const systemPrompt = `You are acting as the ${selectedAgent} within OrchestrateAI. Provide a helpful, precise, and professional response to the user's query.${imageForRequest ? '\nIf an image is attached, analyze it carefully and include relevant visual observations.' : ''}\n\nUser: ${userMsg || 'Analyze the attached image.'}`;

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
    } catch (err: any) {
      addMessage(convId!, { role: 'assistant', content: `Error processing request: ${err.message}. Please check your API keys and try again.`, agent: 'System' });
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
                    <a.icon className="w-4 h-4 text-primary" />
                    {a.id}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{a.desc}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                    <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary transition-colors">
                      <agent.icon className="w-4 h-4" />
                      {agent.id}
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