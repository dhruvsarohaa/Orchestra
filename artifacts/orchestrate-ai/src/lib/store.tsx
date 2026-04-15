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

type State = {
  isAuthenticated: boolean;
  apiKeyGemini: string;
  apiKeyGroq: string;
  apiKeyOpenRouter: string;
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedModel: string;
  selectedAgent: string;
};

type Actions = {
  login: (password: string) => boolean;
  logout: () => void;
  setApiKeyGemini: (key: string) => void;
  setApiKeyGroq: (key: string) => void;
  setApiKeyOpenRouter: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedAgent: (agent: string) => void;
  createConversation: () => string;
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id'>) => void;
  deleteConversation: (id: string) => void;
};

const AppContext = createContext<(State & Actions) | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>(() => {
    const saved = localStorage.getItem('orchestrate-ai-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          currentConversationId: null, // Reset on load
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      isAuthenticated: false,
      apiKeyGemini: '',
      apiKeyGroq: '',
      apiKeyOpenRouter: '',
      conversations: [],
      currentConversationId: null,
      selectedModel: 'gemini-1.5-flash',
      selectedAgent: 'Auto Orchestrator',
    };
  });

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
  const setSelectedModel = (model: string) => setState(s => ({ ...s, selectedModel: model }));
  const setSelectedAgent = (agent: string) => setState(s => ({ ...s, selectedAgent: agent }));

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
    setState(s => {
      const convs = [...s.conversations];
      const idx = convs.findIndex(c => c.id === conversationId);
      if (idx === -1) return s;
      
      const conv = { ...convs[idx] };
      conv.messages = [...conv.messages, { ...message, id: Date.now().toString() + Math.random().toString() }];
      conv.updatedAt = Date.now();
      
      if (conv.messages.length === 1 && message.role === 'user') {
        conv.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
      }
      
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
      login, logout, setApiKeyGemini, setApiKeyGroq, setApiKeyOpenRouter, setSelectedModel, setSelectedAgent,
      createConversation, setCurrentConversation, addMessage, deleteConversation
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
