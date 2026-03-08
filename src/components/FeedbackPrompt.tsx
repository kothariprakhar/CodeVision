// ABOUTME: Toast-style proactive feedback prompt that slides in from top-right
// ABOUTME: Encourages users to give feedback, auto-dismisses after 10 seconds, tracks dismissed state in localStorage

'use client';

import React, { useState, useEffect } from 'react';

interface FeedbackPromptProps {
  onOpenFeedback: () => void;
}

export default function FeedbackPrompt({ onOpenFeedback }: FeedbackPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('feedback-prompt-dismissed', 'true');
      }
    }, 300); // Match animation duration
  };

  const handleGiveFeedback = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('feedback-prompt-dismissed', 'true');
      }
      onOpenFeedback();
    }, 300); // Match animation duration
  };

  useEffect(() => {
    // Check if running in browser
    if (typeof window === 'undefined') return;

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('feedback-prompt-dismissed');
    if (dismissed === 'true') {
      return;
    }

    // Show prompt after a short delay
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    // Auto-hide after 10 seconds
    const hideTimer = setTimeout(() => {
      handleDismiss();
    }, 12000); // 2s delay + 10s visible

    // Cleanup timers
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-6 right-6 w-full sm:w-96 bg-gradient-to-br from-gray-900/95 to-purple-900/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/10 z-[997] ${
        isAnimatingOut ? 'animate-slide-out-top-right' : 'animate-slide-in-top-right'
      }`}
    >
      {/* Content */}
      <div className="p-4">
        {/* Header with close button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Icon */}
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-white font-semibold text-base">We&apos;d love your feedback</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                Help us improve your experience
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleGiveFeedback}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105"
          >
            Give Feedback
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-white/10"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
