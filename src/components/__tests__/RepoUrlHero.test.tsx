import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RepoUrlHero, { isValidGitHubRepoUrl } from '@/components/RepoUrlHero';

describe('RepoUrlHero', () => {
  it('validates github URLs correctly', () => {
    expect(isValidGitHubRepoUrl('https://github.com/org/repo')).toBe(true);
    expect(isValidGitHubRepoUrl('https://github.com/org/repo.git')).toBe(true);
    expect(isValidGitHubRepoUrl('https://gitlab.com/org/repo')).toBe(false);
    expect(isValidGitHubRepoUrl('not-a-url')).toBe(false);
  });

  it('submits valid repo URL', () => {
    const onAnalyze = vi.fn();
    render(<RepoUrlHero onAnalyze={onAnalyze} />);

    fireEvent.change(screen.getByLabelText('GitHub repository URL'), {
      target: { value: 'https://github.com/vercel/next.js' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze repository/i }));

    expect(onAnalyze).toHaveBeenCalledWith('https://github.com/vercel/next.js');
  });
});
