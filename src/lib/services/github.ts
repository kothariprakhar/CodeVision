import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';

const REPOS_DIR = '/tmp/repos';

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function validateGitHubAccess(
  repoUrl: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      return { valid: false, error: 'Invalid GitHub URL format' };
    }

    const [, owner, repo] = match;

    // Test API access
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 200) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token or token has expired' };
    } else if (response.status === 403) {
      return { valid: false, error: 'Token does not have access to this repository' };
    } else if (response.status === 404) {
      return { valid: false, error: 'Repository not found or is private' };
    } else {
      return { valid: false, error: `GitHub API error: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: `Failed to validate: ${error}` };
  }
}

export async function cloneRepository(
  repoUrl: string,
  token: string,
  projectId: string
): Promise<CloneResult> {
  // Ensure repos directory exists
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  const clonePath = path.join(REPOS_DIR, projectId);

  // Clean up existing clone if present
  if (fs.existsSync(clonePath)) {
    fs.rmSync(clonePath, { recursive: true, force: true });
  }

  try {
    let cloneUrl: string;

    if (token) {
      const urlObj = new URL(repoUrl);
      cloneUrl = `https://${token}@${urlObj.host}${urlObj.pathname}`;
    } else {
      cloneUrl = repoUrl;
    }

    const git: SimpleGit = simpleGit();

    await git.clone(cloneUrl, clonePath, [
      '--depth=1',
      '--single-branch',
    ]);

    return { success: true, path: clonePath };
  } catch (error) {
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
    return {
      success: false,
      error: `Failed to clone repository: ${error}`,
    };
  }
}

export function getProjectRepoPath(projectId: string): string {
  return path.join(REPOS_DIR, projectId);
}

export function getRelevantFiles(repoPath: string): string[] {
  const relevantFiles: string[] = [];
  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '__pycache__',
    '.venv',
    'venv',
    'vendor',
  ]);

  const relevantExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx',
    '.py', '.rb', '.go', '.java',
    '.cs', '.php', '.swift', '.kt',
    '.rs', '.cpp', '.c', '.h',
  ]);

  function walkDir(dir: string, depth: number = 0): void {
    if (depth > 10) return; // Max depth to prevent infinite loops

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walkDir(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (relevantExtensions.has(ext)) {
          relevantFiles.push(relativePath);
        }
      }
    }
  }

  walkDir(repoPath);
  return relevantFiles;
}
