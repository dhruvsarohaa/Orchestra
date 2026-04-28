import React, { createContext, useContext, useState, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

export type Theme = 'dark' | 'light' | 'system';

type State = {
  isAuthenticated: boolean;
  apiKeyGemini: string;
  apiKeyGroq: string;
  apiKeyOpenRouter: string;
  apiKeyAnthropic: string;
  apiKeyTogether: string;
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedModel: string;
  selectedAgent: string;
  theme: Theme;
};

type Actions = {
  login: (password: string) => boolean;
  logout: () => void;
  setApiKeyGemini: (key: string) => void;
  setApiKeyGroq: (key: string) => void;
  setApiKeyOpenRouter: (key: string) => void;
  setApiKeyAnthropic: (key: string) => void;
  setApiKeyTogether: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedAgent: (agent: string) => void;
  setTheme: (theme: Theme) => void;
  createConversation: () => string;
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id'>) => string;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteConversation: (id: string) => void;
};

const AppContext = createContext<(State & Actions) | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>(() => {
    const defaults: State = {
      isAuthenticated: false,
      apiKeyGemini: '',
      apiKeyGroq: '',
      apiKeyOpenRouter: '',
      apiKeyAnthropic: '',
      apiKeyTogether: '',
      conversations: [],
      currentConversationId: null,
      selectedModel: 'gemini-1.5-flash-latest',
      selectedAgent: 'Auto Orchestrator',
      theme: 'dark',
    };
    const saved = localStorage.getItem('orchestrate-ai-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          apiKeyGemini: parsed.apiKeyGemini ?? '',
          apiKeyGroq: parsed.apiKeyGroq ?? '',
          apiKeyOpenRouter: parsed.apiKeyOpenRouter ?? '',
          apiKeyAnthropic: parsed.apiKeyAnthropic ?? '',
          apiKeyTogether: parsed.apiKeyTogether ?? '',
          theme: parsed.theme ?? 'dark',
          currentConversationId: null,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return defaults;
  });

  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: 'dark' | 'light') => {
      if (mode === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };
    if (state.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(state.theme);
    return undefined;
  }, [state.theme]);

  useEffect(() => {
    localStorage.setItem('orchestrate-ai-state', JSON.stringify({
      ...state,
      currentConversationId: null,
    }));
  }, [state]);

  const login = (password: string) => {
    if (password === 'dhruv111') {
      setState(s => ({ ...s, isAuthenticated: true }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setState(s => ({ ...s, isAuthenticated: false }));
  };

  const setApiKeyGemini = (key: string) => setState(s => ({ ...s, apiKeyGemini: key }));
  const setApiKeyGroq = (key: string) => setState(s => ({ ...s, apiKeyGroq: key }));
  const setApiKeyOpenRouter = (key: string) => setState(s => ({ ...s, apiKeyOpenRouter: key }));
  const setApiKeyAnthropic = (key: string) => setState(s => ({ ...s, apiKeyAnthropic: key }));
  const setApiKeyTogether = (key: string) => setState(s => ({ ...s, apiKeyTogether: key }));
  const setSelectedModel = (model: string) => setState(s => ({ ...s, selectedModel: model }));
  const setSelectedAgent = (agent: string) => setState(s => ({ ...s, selectedAgent: agent }));
  const setTheme = (theme: Theme) => setState(s => ({ ...s, theme }));

  const createConversation = () => {
    const id = Date.now().toString();
    const newConv: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
    };
    setState(s => ({
      ...s,
      conversations: [newConv, ...s.conversations],
      currentConversationId: id,
    }));
    return id;
  };

  const setCurrentConversation = (id: string) => {
    setState(s => ({ ...s, currentConversationId: id }));
  };

  const addMessage = (conversationId: string, message: Omit<Message, 'id'>) => {
    const newId = Date.now().toString() + Math.random().toString(36).slice(2);
    setState(s => {
      const convs = [...s.conversations];
      const idx = convs.findIndex(c => c.id === conversationId);
      if (idx === -1) return s;
      
      const conv = { ...convs[idx] };
      conv.messages = [...conv.messages, { ...message, id: newId }];
      conv.updatedAt = Date.now();
      
      if (conv.messages.length === 1 && message.role === 'user') {
        conv.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
      }
      
      convs[idx] = conv;
      return { ...s, conversations: convs };
    });
    return newId;
  };

  const updateMessage = (conversationId: string, messageId: string, content: string) => {
    setState(s => {
      const convs = [...s.conversations];
      const idx = convs.findIndex(c => c.id === conversationId);
      if (idx === -1) return s;
      const conv = { ...convs[idx] };
      conv.messages = conv.messages.map(m => m.id === messageId ? { ...m, content } : m);
      conv.updatedAt = Date.now();
      convs[idx] = conv;
      return { ...s, conversations: convs };
    });
  };

  const deleteConversation = (id: string) => {
    setState(s => ({
      ...s,
      conversations: s.conversations.filter(c => c.id !== id),
      currentConversationId: s.currentConversationId === id ? null : s.currentConversationId,
    }));
  };

  return (
    <AppContext.Provider value={{
      ...state,
      login, logout, setApiKeyGemini, setApiKeyGroq, setApiKeyOpenRouter, setApiKeyAnthropic, setApiKeyTogether,
      setSelectedModel, setSelectedAgent, setTheme,
      createConversation, setCurrentConversation, addMessage, updateMessage, deleteConversation
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
};
