// ABOUTME: GitHub API service for listing branches, PRs, and recent commits.
// ABOUTME: Provides ref resolution for branch/PR/commit-aware analysis with in-memory caching.

export interface GitRef {
  name: string;
  sha: string;
  type: 'branch' | 'pr' | 'commit';
  prNumber?: number;
  prTitle?: string;
  prState?: 'open' | 'closed' | 'merged';
  headBranch?: string;
  message?: string;
  author?: string;
  date?: string;
}

export interface GitRefsResult {
  branches: GitRef[];
  pullRequests: GitRef[];
  recentCommits: GitRef[];
  defaultBranch: string;
}

interface CacheEntry {
  data: GitRefsResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000;
const refsCache = new Map<string, CacheEntry>();

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) throw new Error('Invalid GitHub repository URL');
  return { owner: match[1], repo: match[2] };
}

function buildHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CodeVision-Refs',
  };
  if (githubToken?.trim()) {
    headers.Authorization = `token ${githubToken.trim()}`;
  }
  return headers;
}

export async function listGitRefs(
  repoUrl: string,
  githubToken?: string
): Promise<GitRefsResult> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = `${owner}/${repo}`;

  const cached = refsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = buildHeaders(githubToken);

  const [branchesRes, prsRes, commitsRes, repoRes] = await Promise.all([
    fetch(`${base}/branches?per_page=30`, { headers }),
    fetch(`${base}/pulls?state=open&per_page=20&sort=updated&direction=desc`, { headers }),
    fetch(`${base}/commits?per_page=15`, { headers }),
    fetch(base, { headers }),
  ]);

  let defaultBranch = 'main';
  if (repoRes.ok) {
    const repoJson = await repoRes.json() as { default_branch?: string };
    defaultBranch = repoJson.default_branch || 'main';
  }

  const branches: GitRef[] = [];
  if (branchesRes.ok) {
    const data = await branchesRes.json() as Array<{
      name: string;
      commit: { sha: string };
    }>;
    for (const branch of data) {
      branches.push({
        name: branch.name,
        sha: branch.commit.sha,
        type: 'branch',
      });
    }
  }

  const pullRequests: GitRef[] = [];
  if (prsRes.ok) {
    const data = await prsRes.json() as Array<{
      number: number;
      title: string;
      state: string;
      head: { ref: string; sha: string };
      updated_at: string;
      user?: { login?: string };
    }>;
    for (const pr of data) {
      pullRequests.push({
        name: `PR #${pr.number}: ${pr.title}`,
        sha: pr.head.sha,
        type: 'pr',
        prNumber: pr.number,
        prTitle: pr.title,
        prState: pr.state as 'open' | 'closed',
        headBranch: pr.head.ref,
        author: pr.user?.login,
        date: pr.updated_at,
      });
    }
  }

  const recentCommits: GitRef[] = [];
  if (commitsRes.ok) {
    const data = await commitsRes.json() as Array<{
      sha: string;
      commit: {
        message: string;
        author?: { name?: string; date?: string };
      };
    }>;
    for (const commit of data) {
      recentCommits.push({
        name: commit.sha.slice(0, 7),
        sha: commit.sha,
        type: 'commit',
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author?.name,
        date: commit.commit.author?.date,
      });
    }
  }

  const result: GitRefsResult = { branches, pullRequests, recentCommits, defaultBranch };

  refsCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

export async function getPRHeadRef(
  repoUrl: string,
  githubToken: string,
  prNumber: number
): Promise<{ branch: string; sha: string }> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const headers = buildHeaders(githubToken);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR #${prNumber}: ${response.status}`);
  }

  const data = await response.json() as {
    head: { ref: string; sha: string };
  };

  return { branch: data.head.ref, sha: data.head.sha };
}
