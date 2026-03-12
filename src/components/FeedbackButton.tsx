// ABOUTME: Floating feedback button component visible globally
// ABOUTME: Triggers feedback panel when clicked, styled with purple gradient

'use client';

import React from 'react';

interface FeedbackButtonProps {
  onClick: () => void;
}

export default function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full shadow-lg hover:scale-110 transition-transform duration-200 flex items-center justify-center z-[999] group animate-pulse-slow"
      aria-label="Send Feedback"
    >
      {/* Star icon — feedback/rating */}
      <svg
        className="w-6 h-6 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.601a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>

      {/* Tooltip — left of button */}
      <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
        Send Feedback
      </span>
    </button>
  );
}
