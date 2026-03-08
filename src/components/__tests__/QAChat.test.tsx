import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QAChat from '@/components/QAChat';

describe('QAChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads history, sends question, and renders assistant response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: [],
          starter_questions: ['How does authentication work?'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: {
            id: 'assistant-1',
            content: 'Authentication is handled by a login flow and session checks.',
            responseType: 'quick',
            timestamp: new Date().toISOString(),
            followUps: ['Where are session checks implemented?'],
            referencedModules: ['auth-service'],
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const onHighlight = vi.fn();
    render(<QAChat analysisId="analysis-1" onHighlightModule={onHighlight} onOpenArchitecture={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('How does authentication work?')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
      target: { value: 'How does authentication work?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => {
      expect(screen.getByText(/Authentication is handled/i)).toBeInTheDocument();
      expect(screen.getByText('Highlight auth-service')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Highlight auth-service'));
    expect(onHighlight).toHaveBeenCalledWith('auth-service');
  });
});
