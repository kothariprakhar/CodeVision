// ABOUTME: Slide-in chat panel that wraps QAChat with Normal/Developer mode toggle.
// ABOUTME: Mode preference is persisted in localStorage under 'chat-dev-mode'.

'use client';

import { useState } from 'react';
import QAChat from '@/components/QAChat';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId: string;
  onHighlightModule?: (moduleId: string) => void;
  onOpenArchitecture?: () => void;
}

export default function ChatPanel({
  isOpen,
  onClose,
  analysisId,
  onHighlightModule,
  onOpenArchitecture,
}: ChatPanelProps) {
  const [devMode, setDevMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('chat-dev-mode') === 'true';
  });
  const [clearKey, setClearKey] = useState(0);

  const toggleMode = () => {
    setDevMode(prev => {
      const next = !prev;
      localStorage.setItem('chat-dev-mode', String(next));
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — above all floating buttons */}
      <div
        className="fixed inset-0 bg-black/50 z-[1002]"
        onClick={onClose}
      />

      {/* Panel — above backdrop */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[520px] z-[1003] flex flex-col shadow-2xl animate-slide-in-right ${
        devMode
          ? 'bg-gradient-to-br from-gray-950/99 to-red-950/90 backdrop-blur-xl'
          : 'bg-gradient-to-br from-gray-900/98 to-indigo-950/95 backdrop-blur-xl'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-4 ${
          devMode ? 'border-red-500/20' : 'border-white/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
              devMode ? 'bg-gradient-to-r from-red-600 to-orange-600' : 'bg-gradient-to-r from-cyan-500 to-teal-600'
            }`}>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {devMode ? 'CodeVision Dev Mode' : 'CodeVision Assistant'}
              </h2>
              <p className={`text-xs ${devMode ? 'text-red-400/80' : 'text-gray-400'}`}>
                {devMode ? 'Engineering-level insights' : 'Plain-English answers'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle pill */}
            <div className={`flex rounded-full border p-0.5 text-xs font-medium ${
              devMode ? 'border-red-500/30 bg-red-950/40' : 'border-white/15 bg-white/5'
            }`}>
              <button
                onClick={() => !devMode || toggleMode()}
                className={`rounded-full px-3 py-1.5 transition-all ${
                  !devMode
                    ? 'bg-indigo-500/70 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Plain English
              </button>
              <button
                onClick={() => devMode || toggleMode()}
                className={`rounded-full px-3 py-1.5 transition-all font-mono ${
                  devMode
                    ? 'bg-red-600/70 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {'<Dev/>'}
              </button>
            </div>

            {/* Clear chat */}
            <button
              onClick={() => setClearKey(k => k + 1)}
              title="Clear chat"
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>

            {/* Close */}
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <QAChat
            analysisId={analysisId}
            devMode={devMode}
            clearKey={clearKey}
            onHighlightModule={onHighlightModule}
            onOpenArchitecture={onOpenArchitecture}
          />
        </div>
      </div>
    </>
  );
}
