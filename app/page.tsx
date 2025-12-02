'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'log' | 'error';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize browser session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch('/api/init');
        const data = await res.json();
        if (data.success && data.screenshot) {
          setLiveScreenshot(data.screenshot);
        }
      } catch (error) {
        console.error('Failed to init session:', error);
      }
    };
    initSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLiveScreenshot(null);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const { type, data } = JSON.parse(line);

            if (type === 'screenshot') {
              setLiveScreenshot(data);
            } else if (type === 'log') {
              setMessages((prev) => [...prev, { role: 'log', content: data }]);
            } else if (type === 'response') {
              setMessages((prev) => [...prev, { role: 'assistant', content: data }]);
            } else if (type === 'error') {
              setMessages((prev) => [...prev, { role: 'error', content: data }]);
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: 'Failed to connect to the agent. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      {/* Left Column: Chat */}
      <div className="flex w-1/2 flex-col border-r border-slate-800">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Browser Agent</h1>
              <p className="text-xs text-slate-400">Powered by DeepSeek & Playwright</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 shadow-2xl shadow-violet-500/10">
                <Bot className="h-10 w-10 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Welcome to Browser Agent</h2>
                <p className="max-w-md text-slate-400">
                  I can navigate websites, extract information, and perform automated tasks.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setInput('Go to google.com and search for LangChain')}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm transition-all hover:border-violet-500/50 hover:bg-slate-800"
                >
                  Search on Google
                </button>
                <button
                  onClick={() => setInput('Visit github.com and find trending repositories')}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm transition-all hover:border-violet-500/50 hover:bg-slate-800"
                >
                  Check GitHub trending
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-4',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role !== 'user' && (
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      message.role === 'assistant' ? "bg-gradient-to-br from-violet-500 to-purple-600" :
                        message.role === 'error' ? "bg-red-500/10 text-red-500" :
                          "bg-slate-800 text-slate-400"
                    )}>
                      {message.role === 'assistant' ? <Bot className="h-5 w-5 text-white" /> :
                        message.role === 'error' ? <Monitor className="h-5 w-5" /> :
                          <Monitor className="h-4 w-4" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                        : message.role === 'error'
                          ? 'border border-red-500/20 bg-red-500/10 text-red-200'
                          : message.role === 'log'
                            ? 'font-mono text-xs text-slate-400'
                            : 'border border-slate-700 bg-slate-800/50 text-slate-200'
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span className="text-sm text-slate-400">Working...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 bg-slate-900/50 p-4 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to navigate the web..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30 disabled:opacity-50 disabled:shadow-none"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Live View */}
      <div className="flex w-1/2 flex-col bg-black">
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-slate-200">
            <Monitor className="h-5 w-5" />
            <h2 className="font-semibold">Live Browser View</h2>
            {isLoading && (
              <span className="ml-2 flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                Live
              </span>
            )}
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[url('/grid.svg')] bg-center p-8">
          {liveScreenshot ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
              <img
                src={`data:image/jpeg;base64,${liveScreenshot}`}
                alt="Live Browser View"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
                <Monitor className="h-8 w-8" />
              </div>
              <p>Waiting for browser session...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
