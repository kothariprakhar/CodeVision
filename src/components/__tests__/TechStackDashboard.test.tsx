import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TechStackDashboard from '@/components/TechStackDashboard';

describe('TechStackDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders detected technologies from API payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        analysis_id: 'a1',
        languages: [{ language: 'TypeScript', file_count: 10, percentage: 60 }],
        frameworks: [{ name: 'React', category: 'framework', evidence: ['react'], founder_note: 'UI framework' }],
        infrastructure: [{ name: 'Docker', category: 'infra', evidence: ['dockerfile'], founder_note: 'Containerization' }],
        external_services: [{ name: 'Stripe', category: 'service', evidence: ['stripe'], founder_note: 'Payments' }],
        architecture_pattern: { label: 'monolith', explanation: 'Single deployable service.' },
        complexity_score: 5.4,
        complexity_factors: [],
        what_this_means: [{ technology: 'PostgreSQL', explanation: 'Reliable relational store.' }],
      }),
    })) as unknown as typeof fetch);

    render(<TechStackDashboard analysisId="a1" />);

    await waitFor(() => {
      expect(screen.getByText('Frameworks & Tooling')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Docker')).toBeInTheDocument();
      expect(screen.getByText('Stripe')).toBeInTheDocument();
    });
  });
});
