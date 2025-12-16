// ABOUTME: Slide-out feedback panel with glass-morphism design
// ABOUTME: Captures feedback category, message, and automatic context (browser, console logs, page)

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRecentConsoleLogs } from '@/lib/utils/console-logger';

interface FeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export default function FeedbackPanel({ isOpen, onClose, projectId }: FeedbackPanelProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<'bug_report' | 'feature_request' | 'general_feedback'>('general_feedback');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset form when panel opens
  useEffect(() => {
    if (isOpen) {
      setCategory('general_feedback');
      setMessage('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Gather browser context
      const browserInfo = {
        user_agent: navigator.userAgent,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      };

      // Get console logs
      const consoleLogs = getRecentConsoleLogs();

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          page_url: window.location.href,
          project_id: projectId,
          browser_info: browserInfo,
          console_logs: consoleLogs.length > 0 ? consoleLogs : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[998] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-gradient-to-br from-gray-900/95 to-purple-900/95 backdrop-blur-xl shadow-2xl z-[999] animate-slide-in-right">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold gradient-text">Send Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 h-[calc(100%-80px)] flex flex-col">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              ✓ Thanks for your feedback!
            </div>
          )}

          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="input-dark w-full px-4 py-3 rounded-lg"
              disabled={submitting}
            >
              <option value="general_feedback">💬 General Feedback</option>
              <option value="bug_report">🐛 Bug Report</option>
              <option value="feature_request">✨ Feature Request</option>
            </select>
          </div>

          {/* Message */}
          <div className="mb-6 flex-1 flex flex-col">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              className="input-dark w-full px-4 py-3 rounded-lg resize-none flex-1"
              maxLength={1000}
              required
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-gray-500 text-right">
              {message.length}/1000 characters
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 mb-4">
              We'll receive your email and page context to help us respond
            </p>
            <button
              type="submit"
              disabled={submitting || !message.trim() || success}
              className="btn-primary w-full px-6 py-3 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : success ? '✓ Submitted' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
