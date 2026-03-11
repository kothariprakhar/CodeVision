// ABOUTME: Tests for the ModulesView component.
// ABOUTME: Covers module card rendering, detail panel interactions, connections display, and fallback behavior.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModulesView from '@/components/ModulesView';
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

describe('ModulesView', () => {
  it('renders all module cards', () => {
    render(<ModulesView architecture={testArchitecture} />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows detail panel prompt when nothing selected', () => {
    render(<ModulesView architecture={testArchitecture} />);
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows node description in detail panel when card is clicked', () => {
    render(<ModulesView architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: /Authentication/i }));
    expect(screen.getByText('Handles user login')).toBeInTheDocument();
  });

  it('shows file paths in detail panel', () => {
    render(<ModulesView architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: /Authentication/i }));
    expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
  });

  it('shows outgoing connections', () => {
    render(<ModulesView architecture={testArchitecture} />);
    // auth has outgoing edge to db
    fireEvent.click(screen.getByRole('button', { name: /Authentication/i }));
    expect(screen.getByText('→ Calls / Uses')).toBeInTheDocument();
  });

  it('shows incoming connections', () => {
    render(<ModulesView architecture={testArchitecture} />);
    // auth has incoming edge from ui (Dashboard)
    fireEvent.click(screen.getByRole('button', { name: /Authentication/i }));
    expect(screen.getByText('← Used by')).toBeInTheDocument();
  });

  it('deselects when same card clicked again', () => {
    render(<ModulesView architecture={testArchitecture} />);
    const authButton = screen.getByRole('button', { name: /Authentication/i });
    fireEvent.click(authButton);
    expect(screen.queryByText('Select a module to explore')).not.toBeInTheDocument();
    fireEvent.click(authButton);
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows fallback when no nodes', () => {
    render(<ModulesView architecture={{ nodes: [], edges: [] }} />);
    expect(screen.getByText('No architecture data available')).toBeInTheDocument();
  });
});
