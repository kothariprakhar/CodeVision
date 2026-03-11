import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import TechStackDashboard from '@/components/TechStackDashboard';

const basePayload = {
  analysis_id: 'a1',
  languages: [{ language: 'TypeScript', file_count: 10, percentage: 60 }],
  frameworks: [{ name: 'React', category: 'framework', evidence: ['react'], founder_note: 'UI framework' }],
  infrastructure: [{ name: 'Docker', category: 'infra', evidence: ['dockerfile'], founder_note: 'Containerization' }],
  external_services: [{ name: 'Stripe', category: 'service', evidence: ['stripe'], founder_note: 'Payments' }],
  architecture_pattern: { label: 'monolith', explanation: 'Single deployable service.' },
  complexity_score: 5.4,
  complexity_factors: [],
  what_this_means: [{ technology: 'PostgreSQL', explanation: 'Reliable relational store.' }],
};

function mockTechStackFetch(payload: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  })) as unknown as typeof fetch);
}

describe('TechStackDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders detected technologies from API payload', async () => {
    mockTechStackFetch(basePayload);

    render(<TechStackDashboard analysisId="a1" />);

    await waitFor(() => {
      expect(screen.getByText('Frameworks & Tooling')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Docker')).toBeInTheDocument();
      expect(screen.getByText('Stripe')).toBeInTheDocument();
    });
  });

  it('uses sparse layout mode when category volume is small', async () => {
    mockTechStackFetch({
      ...basePayload,
      frameworks: [{ name: 'React', category: 'framework', evidence: ['react'], founder_note: 'UI framework' }],
      infrastructure: [],
      external_services: [],
    });

    render(<TechStackDashboard analysisId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId('techstack-category-grid')).toHaveAttribute('data-layout-mode', 'sparse');
    });
  });

  it('uses imbalanced layout mode when one category dominates', async () => {
    mockTechStackFetch({
      ...basePayload,
      frameworks: [{ name: 'React', category: 'framework', evidence: ['react'], founder_note: 'UI framework' }],
      infrastructure: [{ name: 'Docker', category: 'infra', evidence: ['dockerfile'], founder_note: 'Containerization' }],
      external_services: Array.from({ length: 9 }).map((_, index) => ({
        name: `Service-${index}`,
        category: 'service',
        evidence: ['signal'],
        founder_note: 'Third-party integration.',
      })),
    });

    render(<TechStackDashboard analysisId="a1" />);

    await waitFor(() => {
      expect(screen.getByTestId('techstack-category-grid')).toHaveAttribute('data-layout-mode', 'imbalanced');
    });
  });
});
