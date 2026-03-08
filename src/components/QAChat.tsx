'use client';

import { useEffect, useRef, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';

interface QAHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
  followUps?: string[];
  referencedModules?: string[];
}

interface QAAnswer {
  id: string;
  content: string;
  responseType: 'quick' | 'detailed';
  timestamp: string;
  followUps: string[];
  referencedModules: string[];
  starterQuestions?: string[];
}

interface QAChatProps {
  analysisId: string;
  onHighlightModule?: (moduleId: string) => void;
  onOpenArchitecture?: () => void;
  founderMode?: boolean;
}

export default function QAChat({
  analysisId,
  onHighlightModule,
  onOpenArchitecture,
  founderMode = false,
}: QAChatProps) {
  const [messages, setMessages] = useState<QAHistoryMessage[]>([]);
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analysisId) return;

    async function loadHistory() {
      setInitialLoading(true);
      try {
        const response = await fetch(`/api/qa/${analysisId}/history`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load Q&A history');
        setMessages(payload.history || []);
        setStarterQuestions(payload.starter_questions || []);
      } catch {
        setMessages([]);
        setStarterQuestions([]);
      } finally {
        setInitialLoading(false);
      }
    }

    loadHistory();
  }, [analysisId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (questionText?: string): Promise<void> => {
    const question = (questionText || input).trim();
    if (!question || loading) return;

    const optimisticUser: QAHistoryMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
      responseType: 'quick',
    };

    setMessages(prev => [...prev, optimisticUser]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`/api/qa/${analysisId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to get answer');

      const answer = payload.answer as QAAnswer;
      const assistantMessage: QAHistoryMessage = {
        id: answer.id,
        role: 'assistant',
        content: answer.content,
        timestamp: answer.timestamp,
        responseType: answer.responseType,
        followUps: answer.followUps,
        referencedModules: answer.referencedModules,
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (answer.starterQuestions?.length) {
        setStarterQuestions(answer.starterQuestions);
      }
    } catch {
      setMessages(prev => prev.filter(item => item.id !== optimisticUser.id));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="text-sm text-gray-400">Loading Q&A workspace...</div>;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Conversational Q&A</h3>
        <p className="text-xs text-gray-400">Ask in plain English. Answers stay founder-friendly and module-aware.</p>
      </div>

      <div className="h-[380px] space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3 text-xs text-gray-300">
            <div className="text-sm text-gray-400">Suggested starters</div>
            <div className="flex flex-wrap gap-2">
              {(starterQuestions.length ? starterQuestions : [
                'How does authentication work here?',
                'What databases does this system rely on?',
                'Where are the biggest business risks?',
              ]).map(question => (
                <button
                  key={question}
                  onClick={() => sendQuestion(question)}
                  className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 transition-colors hover:bg-indigo-500/20"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm ${
                message.role === 'user'
                  ? 'border border-indigo-500/25 bg-indigo-500/20 text-indigo-50'
                  : 'border border-white/10 bg-black/30 text-gray-100'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.role === 'assistant'
                    ? simplifyForFounder(message.content, founderMode)
                    : message.content}
                </div>

                {message.role === 'assistant' && message.referencedModules && message.referencedModules.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.referencedModules.map(moduleId => (
                      <button
                        key={`${message.id}-${moduleId}`}
                        onClick={() => {
                          onHighlightModule?.(moduleId);
                          onOpenArchitecture?.();
                        }}
                        className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200"
                      >
                        Highlight {moduleId}
                      </button>
                    ))}
                  </div>
                )}

                {message.role === 'assistant' && message.followUps && message.followUps.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">Follow-up questions</div>
                    <div className="flex flex-wrap gap-2">
                      {message.followUps.slice(0, 3).map(question => (
                        <button
                          key={`${message.id}-${question}`}
                          onClick={() => sendQuestion(question)}
                          className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/10"
                        >
                          {simplifyForFounder(question, founderMode)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300">
              Thinking through the repository...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion();
              }
            }}
            placeholder="Ask a question about architecture, flows, risks, or tech choices"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-indigo-400/50 focus:outline-none"
          />
          <button
            onClick={() => sendQuestion()}
            disabled={loading || !input.trim()}
            className="rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-4 text-sm font-medium text-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
