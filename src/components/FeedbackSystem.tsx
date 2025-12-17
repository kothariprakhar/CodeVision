// ABOUTME: Client component wrapper that manages feedback button and panel globally
// ABOUTME: Initializes console logger on mount and handles feedback panel state

'use client';

import React, { useState, useEffect } from 'react';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackPanel from '@/components/FeedbackPanel';
import { initializeConsoleLogger } from '@/lib/utils/console-logger';

export default function FeedbackSystem() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    initializeConsoleLogger();
  }, []);

  return (
    <>
      <FeedbackButton onClick={() => setIsPanelOpen(true)} />
      <FeedbackPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </>
  );
}
