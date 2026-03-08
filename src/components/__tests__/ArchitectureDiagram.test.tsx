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
  ],
  edges: [
    { from: 'web', to: 'api', type: 'calls' as const },
  ],
};

describe('ArchitectureDiagram', () => {
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
});
