import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';

const architecture = {
  nodes: [
    {
      id: 'web',
      name: 'Web UI',
      type: 'ui' as const,
      complexity: 'medium' as const,
      description: 'Frontend interface',
      files: ['src/app/page.tsx'],
    },
    {
      id: 'api',
      name: 'API Service',
      type: 'api' as const,
      complexity: 'high' as const,
      description: 'Core backend',
      files: ['src/app/api/repo/analyze/route.ts'],
    },
    {
      id: 'ext',
      name: 'lucide-react',
      type: 'external' as const,
      complexity: 'low' as const,
      description: 'External dependency: lucide-react',
      files: [],
    },
  ],
  edges: [
    { from: 'web', to: 'api', type: 'calls' as const },
    { from: 'web', to: 'ext', type: 'imports' as const, label: 'Depends on lucide-react' },
  ],
};

describe('ArchitectureDiagram', () => {
  it('toggles fullscreen and restores body overflow', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<ArchitectureDiagram architecture={architecture} highlightedNodeId={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Expand/i }));
    const fullscreenRoot = screen.getByTestId('architecture-diagram-root');
    expect(fullscreenRoot.className).toContain('fixed');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: /Exit/i }));
    expect(document.body.style.overflow).toBe('auto');

    fireEvent.click(screen.getByRole('button', { name: /Expand/i }));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('renders key nodes and opens floating detail popup on click', () => {
    render(<ArchitectureDiagram architecture={architecture} highlightedNodeId={null} />);

    const webNode = screen.getByRole('button', { name: /Web UI/i });
    const apiNode = screen.getByRole('button', { name: /API Service/i });

    expect(webNode).toBeInTheDocument();
    expect(apiNode).toBeInTheDocument();

    fireEvent.click(apiNode);
    expect(screen.getAllByText('API Service').length).toBeGreaterThan(0);
    expect(screen.getByText(/Think of this as the/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close details/i })).toBeInTheDocument();
  });

  it('keeps founder copy meaningful without duplicated terms', () => {
    render(<ArchitectureDiagram architecture={architecture} highlightedNodeId={null} founderMode />);

    const externalNodes = screen.getAllByRole('button', { name: /lucide-react/i });
    fireEvent.click(externalNodes[externalNodes.length - 1]);

    expect(screen.queryByText(/external external/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/third-party integration/i).length).toBeGreaterThan(0);
  });
});
