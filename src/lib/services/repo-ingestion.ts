import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';

const REPO_ROOT = '/tmp/repolens';

export interface RepoMetadata {
  job_id: string;
  repo_url: string;
  repo_path: string;
  default_branch?: string;
  stars?: number;
  primary_language?: string | null;
  size_kb?: number;
  languages?: Record<string, number>;
  contributors_count?: number;
  last_commit_date?: string;
}

interface ParsedGitHubRepo {
  owner: string;
  repo: string;
}

function parseGitHubRepo(repoUrl: string): ParsedGitHubRepo {
  try {
    const parsed = new URL(repoUrl);
    const [, owner, repoWithMaybeGit] = parsed.pathname.split('/');
    if (!owner || !repoWithMaybeGit) {
      throw new Error('Invalid GitHub repository path');
    }
    return {
      owner,
      repo: repoWithMaybeGit.replace(/\.git$/, ''),
    };
  } catch {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2] };
  }
}

function buildCloneUrl(repoUrl: string, githubToken?: string): string {
  if (!githubToken?.trim()) return repoUrl;
  const token = encodeURIComponent(githubToken.trim());
  return repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
}

function getContributorsCountFromLinkHeader(linkHeader: string | null): number | undefined {
  if (!linkHeader) return undefined;
  const lastRel = linkHeader.split(',').find(part => part.includes('rel="last"'));
  if (!lastRel) return undefined;
  const match = lastRel.match(/[?&]page=(\d+)/);
  if (!match) return undefined;
  const page = Number(match[1]);
  return Number.isFinite(page) ? page : undefined;
}

export async function fetchRepoMetadata(
  repoUrl: string,
  githubToken?: string
): Promise<Record<string, unknown>> {
  const { owner, repo } = parseGitHubRepo(repoUrl);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CodeVision-RepoIngestion',
  };
  if (githubToken?.trim()) {
    headers.Authorization = `token ${githubToken.trim()}`;
  }

  const [repoResponse, languagesResponse, contributorsResponse, commitsResponse] = await Promise.all([
    fetch(base, { headers }),
    fetch(`${base}/languages`, { headers }),
    fetch(`${base}/contributors?per_page=1&anon=1`, { headers }),
    fetch(`${base}/commits?per_page=1`, { headers }),
  ]);

  if (!repoResponse.ok) {
    throw new Error(`Failed to fetch repo metadata: ${repoResponse.status}`);
  }

  const repoJson = await repoResponse.json() as {
    stargazers_count?: number;
    language?: string | null;
    size?: number;
    default_branch?: string;
  };
  const languages = languagesResponse.ok
    ? await languagesResponse.json() as Record<string, number>
    : {};
  const commits = commitsResponse.ok
    ? await commitsResponse.json() as Array<{ commit?: { committer?: { date?: string } } }>
    : [];

  let contributorsCount: number | undefined;
  if (contributorsResponse.ok) {
    contributorsCount = getContributorsCountFromLinkHeader(contributorsResponse.headers.get('link'));
    if (contributorsCount === undefined) {
      const contributors = await contributorsResponse.json() as unknown[];
      contributorsCount = contributors.length;
    }
  }

  return {
    stars: repoJson.stargazers_count ?? 0,
    primary_language: repoJson.language ?? null,
    size_kb: repoJson.size ?? 0,
    default_branch: repoJson.default_branch ?? 'main',
    languages,
    contributors_count: contributorsCount ?? 0,
    last_commit_date: commits[0]?.commit?.committer?.date,
  };
}

export async function cloneRepo(
  repoUrl: string,
  jobId: string,
  githubToken?: string,
  options?: { branch?: string; commitSha?: string }
): Promise<RepoMetadata> {
  const cloneRoot = path.join(REPO_ROOT, jobId);
  const repoPath = path.join(cloneRoot, 'repo');
  fs.rmSync(cloneRoot, { recursive: true, force: true });
  fs.mkdirSync(cloneRoot, { recursive: true });

  const metadata: Record<string, unknown> = await fetchRepoMetadata(repoUrl, githubToken)
    .catch((): Record<string, unknown> => ({}));
  const cloneUrl = buildCloneUrl(repoUrl, githubToken);

  try {
    const cloneArgs: string[] = ['--depth', '1', '--single-branch'];
    if (options?.branch) {
      cloneArgs.push('--branch', options.branch);
    }
    await simpleGit().clone(cloneUrl, repoPath, cloneArgs);

    if (options?.commitSha) {
      const git = simpleGit(repoPath);
      try {
        await git.checkout(options.commitSha);
      } catch {
        // Shallow clone may not have the commit; deepen and retry
        await git.fetch(['--unshallow']);
        await git.checkout(options.commitSha);
      }
    }
  } catch (error) {
    cleanupClone(jobId);
    throw new Error(
      `Failed to clone repository: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  return {
    job_id: jobId,
    repo_url: repoUrl,
    repo_path: repoPath,
    default_branch: typeof metadata.default_branch === 'string' ? metadata.default_branch : undefined,
    stars: typeof metadata.stars === 'number' ? metadata.stars : undefined,
    primary_language: (metadata.primary_language as string | null | undefined) ?? null,
    size_kb: typeof metadata.size_kb === 'number' ? metadata.size_kb : undefined,
    languages: (metadata.languages as Record<string, number> | undefined) ?? {},
    contributors_count:
      typeof metadata.contributors_count === 'number' ? metadata.contributors_count : undefined,
    last_commit_date:
      typeof metadata.last_commit_date === 'string' ? metadata.last_commit_date : undefined,
  };
}

export function cleanupClone(jobId: string): void {
  const cloneRoot = path.join(REPO_ROOT, jobId);
  fs.rmSync(cloneRoot, { recursive: true, force: true });
}

// Python-style aliases for direct spec mapping.
export const clone_repo = cloneRepo;
export const fetch_repo_metadata = fetchRepoMetadata;
export const cleanup_clone = cleanupClone;
