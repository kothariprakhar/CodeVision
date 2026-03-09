// ABOUTME: Tests for the ArchitectureDiagram component.
// ABOUTME: Covers architecture module grid, data flow chart, interaction, and fallback behavior.
import { render, screen, fireEvent } from '@testing-library/react';
import ArchitectureDiagram from '../ArchitectureDiagram';
import type { ArchitectureVisualization } from '@/lib/db';

const testArchitecture: ArchitectureVisualization = {
  nodes: [
    {
      id: 'auth',
      name: 'Authentication',
      type: 'service',
      complexity: 'medium',
      description: 'Handles user login and session management',
      files: ['src/lib/auth.ts'],
    },
    {
      id: 'ui-node',
      name: 'Project Dashboard',
      type: 'ui',
      complexity: 'low',
      description: 'Main interface for managing projects',
      files: ['src/app/projects/page.tsx'],
    },
    {
      id: 'api-node',
      name: 'Analysis API',
      type: 'api',
      complexity: 'high',
      description: 'REST endpoints that trigger and retrieve analysis',
      files: ['src/app/api/analyze/route.ts'],
    },
    {
      id: 'db',
      name: 'Database',
      type: 'database',
      complexity: 'low',
      description: 'Stores all project and analysis data',
      files: ['src/lib/db.ts'],
    },
  ],
  edges: [
    { from: 'ui-node', to: 'api-node', type: 'calls' },
    { from: 'api-node', to: 'auth', type: 'imports' },
    { from: 'api-node', to: 'db', type: 'stores' },
  ],
  dataFlow: [
    {
      step: 1,
      label: 'User logs in',
      description: 'User authenticates with email and password',
      nodeIds: ['auth', 'ui-node'],
    },
    {
      step: 2,
      label: 'Analysis triggered',
      description: 'User submits their GitHub repo for analysis',
      nodeIds: ['ui-node', 'api-node'],
    },
    {
      step: 3,
      label: 'Results stored',
      description: 'Analysis findings are saved and displayed',
      nodeIds: ['api-node', 'db'],
    },
  ],
};

const emptyArchitecture: ArchitectureVisualization = { nodes: [], edges: [] };

describe('ArchitectureDiagram', () => {
  it('shows fallback message when there are no nodes', () => {
    render(<ArchitectureDiagram architecture={emptyArchitecture} />);
    expect(screen.getByText('No architecture data available')).toBeInTheDocument();
  });

  it('renders the Modules view toggle button', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByRole('button', { name: 'Modules' })).toBeInTheDocument();
  });

  it('renders the User Flow view toggle button', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByRole('button', { name: 'User Flow' })).toBeInTheDocument();
  });

  it('shows all module cards in architecture view by default', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Analysis API')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('switches to user flow view when User Flow button is clicked', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: 'User Flow' }));
    expect(screen.getByText('User / Browser')).toBeInTheDocument();
    expect(screen.getByText('User logs in')).toBeInTheDocument();
    expect(screen.getByText('Analysis triggered')).toBeInTheDocument();
  });

  it('shows detail panel prompt when no node is selected', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows node description in detail panel when a module card is clicked', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('Handles user login and session management')).toBeInTheDocument();
  });

  it('shows file path in detail panel when a module card is clicked', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('src/lib/auth.ts')).toBeInTheDocument();
  });

  it('shows outgoing connections label in detail panel', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    // ui-node → api-node, so clicking "Project Dashboard" shows outgoing connections
    fireEvent.click(screen.getByText('Project Dashboard'));
    expect(screen.getByText('→ Calls / Uses')).toBeInTheDocument();
  });

  it('shows incoming connections label in detail panel', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    // api-node → auth, so clicking "Authentication" shows incoming connections
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('← Used by')).toBeInTheDocument();
  });

  it('deselects a node when the same card is clicked again', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    // Find the card button by its name text before clicking
    const cards = screen.getAllByText('Authentication');
    const card = cards[0].closest('button');
    fireEvent.click(card!);
    expect(screen.queryByText('Select a module to explore')).not.toBeInTheDocument();
    // Click the card button again to deselect
    fireEvent.click(card!);
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows inferred flow stages in data flow view when dataFlow is absent', () => {
    const noDataFlow: ArchitectureVisualization = { ...testArchitecture, dataFlow: undefined };
    render(<ArchitectureDiagram architecture={noDataFlow} />);
    fireEvent.click(screen.getByRole('button', { name: 'User Flow' }));
    expect(screen.getByText('User / Browser')).toBeInTheDocument();
    // Should show a type-inferred stage label
    expect(screen.getByText('API Routes')).toBeInTheDocument();
  });

  it('shows explicit dataFlow step descriptions when dataFlow is present', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: 'User Flow' }));
    expect(screen.getByText('User authenticates with email and password')).toBeInTheDocument();
    expect(screen.getByText('User submits their GitHub repo for analysis')).toBeInTheDocument();
  });
});
