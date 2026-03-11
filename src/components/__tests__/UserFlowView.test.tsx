// ABOUTME: Tests for the UserFlowView component.
// ABOUTME: Covers starting node render, inferred flow stages, and explicit dataFlow steps display.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserFlowView from '@/components/UserFlowView';
import type { ArchitectureVisualization } from '@/lib/db';

const testArchitecture: ArchitectureVisualization = {
  nodes: [
    { id: 'auth', name: 'Authentication', type: 'api', complexity: 'medium', description: 'Handles user login', files: ['src/auth.ts', 'src/auth2.ts'] },
    { id: 'db', name: 'Database', type: 'database', complexity: 'low', description: 'Stores user data', files: ['src/db.ts'] },
    { id: 'ui', name: 'Dashboard', type: 'ui', complexity: 'high', description: 'Main UI', files: ['src/ui.tsx'] },
  ],
  edges: [
    { from: 'auth', to: 'db', type: 'stores' },
    { from: 'ui', to: 'auth', type: 'calls' },
  ],
};

describe('UserFlowView', () => {
  it('renders User / Browser starting node', () => {
    render(<UserFlowView architecture={testArchitecture} />);
    expect(screen.getByText('User / Browser')).toBeInTheDocument();
  });

  it('shows inferred stages when no dataFlow', () => {
    render(<UserFlowView architecture={testArchitecture} />);
    const stageLabels = ['Frontend', 'API Routes', 'Business Logic', 'Data Storage', 'External Services'];
    const found = stageLabels.some(label => screen.queryByText(label) !== null);
    expect(found).toBe(true);
  });

  it('shows explicit dataFlow steps when present', () => {
    const withFlow: ArchitectureVisualization = {
      ...testArchitecture,
      dataFlow: [
        { step: 1, label: 'Login Request', description: 'User submits credentials', nodeIds: ['auth'] },
        { step: 2, label: 'Data Store', description: 'Credentials verified against DB', nodeIds: ['db'] },
      ],
    };
    render(<UserFlowView architecture={withFlow} />);
    expect(screen.getByText('Login Request')).toBeInTheDocument();
    expect(screen.getByText('Data Store')).toBeInTheDocument();
  });

  it('shows node names in explicit dataFlow steps', () => {
    const withFlow: ArchitectureVisualization = {
      ...testArchitecture,
      dataFlow: [
        { step: 1, label: 'Login Request', description: 'User submits credentials', nodeIds: ['auth'] },
        { step: 2, label: 'Data Store', description: 'Credentials verified against DB', nodeIds: ['db'] },
      ],
    };
    render(<UserFlowView architecture={withFlow} />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });
});
