import { getProject, updateProject } from '../repositories/projects';
import { getDocumentsByProject } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { downloadRepository, cloneRepository, extractGitMetadata } from './github';
import { parseAllDocuments } from './file-parser';
import { analyzeCodeAlignment, readCodeFile } from './claude';
import { generateBusinessLensArtifacts } from './lenses';
import { cloneRepo, cleanupClone, fetchRepoMetadata } from './repo-ingestion';
import { buildFileManifest, groupByModule, prioritizeFiles } from './chunker-service';
import { runFullAnalysis } from './analysis-service';
import type { ArchitectureVisualization, Finding, FounderContent } from '../db';
import {
  buildStructuralAnalysisContext,
  detectPatterns,
  extractDependencyGraph,
  parseFile,
} from './parser-service';

export interface AnalyzeProjectResult {
  success: boolean;
  error?: string;
  analysisId?: string;
}

export interface AnalyzeProjectOptions {
  onProgress?: (event: { stage: string; progress: number; message: string }) => void;
  shouldCancel?: () => boolean;
}

interface CloneMetadataSignals {
  default_branch?: string;
  stars?: number;
  primary_language?: string | null;
  size_kb?: number;
  contributors_count?: number;
  last_commit_date?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function estimateGraphDepth(edges: Array<{ source: string; target: string }>): number {
  if (edges.length === 0) return 1;

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.source, indegree.get(edge.source) || 0);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  });

  const queue: string[] = Array.from(adjacency.keys()).filter(node => (indegree.get(node) || 0) === 0);
  const depth = new Map<string, number>();
  Array.from(adjacency.keys()).forEach(node => depth.set(node, 1));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const nextDepth = (depth.get(current) || 1) + 1;
    (adjacency.get(current) || []).forEach(target => {
      if (nextDepth > (depth.get(target) || 1)) {
        depth.set(target, nextDepth);
      }
      indegree.set(target, (indegree.get(target) || 0) - 1);
      if ((indegree.get(target) || 0) === 0) {
        queue.push(target);
      }
    });
  }

  return Math.max(1, ...Array.from(depth.values()));
}

function mergeDeterministicSignalsIntoRawResponse(
  rawResponse: string,
  deterministicSignals: Record<string, unknown>
): string {
  try {
    const parsed = JSON.parse(rawResponse) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const output = parsed as Record<string, unknown>;
      output.deterministic_signals = deterministicSignals;
      return JSON.stringify(output);
    }
  } catch {
    // Fallback below wraps opaque response.
  }

  return JSON.stringify({
    engine: 'fallback_single_pass',
    raw_text: rawResponse,
    deterministic_signals: deterministicSignals,
  });
}

export async function analyzeProject(
  projectId: string,
  options?: AnalyzeProjectOptions
): Promise<AnalyzeProjectResult> {
  const emit = (stage: string, progress: number, message: string): void => {
    options?.onProgress?.({ stage, progress, message });
  };
  const assertNotCancelled = (): void => {
    if (options?.shouldCancel?.()) {
      throw new Error('Analysis cancelled');
    }
  };

  const project = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const documents = await getDocumentsByProject(projectId);
  if (documents.length === 0) {
    return { success: false, error: 'No documents uploaded. Please upload requirements documents first.' };
  }

  let shouldCleanupClone = false;
  let cloneMetadataSignals: CloneMetadataSignals = {};
  try {
    emit('cloning', 10, 'Cloning repository...');
    assertNotCancelled();

    // Update status to analyzing
    await updateProject(projectId, { status: 'analyzing' });

    // Delete previous analysis if exists
    await deleteProjectAnalysis(projectId);

    // Parse all uploaded documents first
    const documentPaths = documents.map(doc => doc.file_path);
    const parsedDocs = await parseAllDocuments(documentPaths);
    if (parsedDocs.length === 0) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: 'Failed to parse any documents' };
    }

    // Component 1: Intelligent repo ingestion with clone + prioritized manifest.
    let repoPath: string | null = null;
    try {
      assertNotCancelled();
      const cloned = await cloneRepo(project.github_url, project.id, project.github_token);
      repoPath = cloned.repo_path;
      shouldCleanupClone = true;
      cloneMetadataSignals = {
        default_branch: cloned.default_branch,
        stars: cloned.stars,
        primary_language: cloned.primary_language,
        size_kb: cloned.size_kb,
        contributors_count: cloned.contributors_count,
        last_commit_date: cloned.last_commit_date,
      };
      console.log('Depth-1 repository clone completed');
      console.log('Repository metadata:', cloneMetadataSignals);
    } catch (cloneError) {
      console.warn('Depth-1 clone failed, falling back to download/clone path');
      console.warn(cloneError instanceof Error ? cloneError.message : 'Unknown clone error');
      try {
        const metadata = await fetchRepoMetadata(project.github_url, project.github_token);
        cloneMetadataSignals = {
          stars: typeof metadata.stars === 'number' ? metadata.stars : undefined,
          primary_language:
            typeof metadata.primary_language === 'string'
              ? metadata.primary_language
              : (metadata.primary_language === null ? null : undefined),
          size_kb: typeof metadata.size_kb === 'number' ? metadata.size_kb : undefined,
          contributors_count:
            typeof metadata.contributors_count === 'number' ? metadata.contributors_count : undefined,
          last_commit_date:
            typeof metadata.last_commit_date === 'string' ? metadata.last_commit_date : undefined,
        };
      } catch (metadataError) {
        console.warn('Failed to fetch repository metadata during fallback path');
        console.warn(metadataError instanceof Error ? metadataError.message : 'Unknown metadata error');
      }

      let downloadResult = await downloadRepository(project.github_url, project.github_token, project.id);
      if (!downloadResult.success) {
        downloadResult = await cloneRepository(project.github_url, project.github_token, project.id);
      }
      if (!downloadResult.success || !downloadResult.path) {
        await updateProject(projectId, { status: 'failed' });
        return { success: false, error: downloadResult.error || 'Failed to download repository' };
      }
      repoPath = downloadResult.path;
    }

    if (!repoPath) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: 'Repository path is unavailable after ingestion' };
    }

    const manifest = prioritizeFiles(buildFileManifest(repoPath));
    if (manifest.length === 0) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: 'No analyzable source/config files found after filtering' };
    }

    const groupedByModule = groupByModule(manifest);
    const prioritizedEntries = manifest
      .filter(entry => entry.category !== 'test')
      .slice(0, 400);
    const selectedEntries = prioritizedEntries.length > 0 ? prioritizedEntries : manifest.slice(0, 250);

    const codeFiles = selectedEntries.map(entry => ({
      path: entry.path,
      content: readCodeFile(repoPath, entry.path),
    }));

    if (codeFiles.length === 0) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: 'Failed to read prioritized files from repository' };
    }

    console.log('Ingestion summary:', {
      total_manifest_files: manifest.length,
      selected_files: selectedEntries.length,
      top_modules: Object.keys(groupedByModule).slice(0, 8),
    });

    emit('parsing', 30, `Analyzing ${selectedEntries.length} files...`);
    assertNotCancelled();
    const parsedFiles = await Promise.all(
      selectedEntries.map((entry, index) =>
        parseFile(entry.path, entry.language, codeFiles[index]?.content || '')
      )
    );
    const dependencyGraph = extractDependencyGraph(parsedFiles);
    const archPatterns = detectPatterns(parsedFiles);
    const structuralContext = buildStructuralAnalysisContext(parsedFiles, dependencyGraph, archPatterns);

    console.log('AST parser summary:', {
      parsed_files: parsedFiles.length,
      dependency_nodes: dependencyGraph.nodes.length,
      dependency_edges: dependencyGraph.edges.length,
      detected_patterns: archPatterns.map(pattern => pattern.pattern),
    });

    // Extract git metadata
    const gitMetadata = await extractGitMetadata(repoPath, project.github_url);
    console.log('Git metadata:', gitMetadata);

    const manifestLanguageCounts = manifest.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.language] = (acc[entry.language] || 0) + 1;
      return acc;
    }, {});
    const manifestCategoryCounts = manifest.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1;
      return acc;
    }, {});
    const deterministicSignals: Record<string, unknown> = {
      file_manifest_paths: manifest.map(entry => entry.path).slice(0, 2500),
      file_manifest_languages: manifestLanguageCounts,
      file_manifest_categories: manifestCategoryCounts,
      repo_metadata: cloneMetadataSignals,
      dependency_graph_stats: {
        nodes: dependencyGraph.nodes.length,
        edges: dependencyGraph.edges.length,
        max_depth: estimateGraphDepth(dependencyGraph.edges),
      },
      parse_stats: {
        selected_files: selectedEntries.length,
        parsed_files: parsedFiles.length,
      },
      git: {
        branch: gitMetadata?.branch,
        commit_hash: gitMetadata?.commitHash,
      },
    };

    // Component 3: Anthropic multi-pass analysis engine with fallback.
    let analysisOutput: {
      summary: string;
      findings: Finding[];
      architecture: ArchitectureVisualization;
      founder_content?: FounderContent | null;
      raw_response: string;
    };
    try {
      assertNotCancelled();
      const fullAnalysis = await runFullAnalysis({
        repo_url: project.github_url,
        commit_sha: gitMetadata?.commitHash,
        project_name: project.name,
        documents: parsedDocs,
        manifest,
        module_groups: groupedByModule,
        parsed_files: parsedFiles,
        dependency_graph: dependencyGraph,
        patterns: archPatterns,
        code_files: codeFiles,
      }, project.id, {
        onProgress: (event) => emit(event.stage, event.progress, event.message),
      });

      analysisOutput = {
        summary: fullAnalysis.summary,
        findings: fullAnalysis.findings,
        architecture: fullAnalysis.architecture,
        founder_content: fullAnalysis.founder_content,
        raw_response: mergeDeterministicSignalsIntoRawResponse(fullAnalysis.raw_response, deterministicSignals),
      };
    } catch (multiPassError) {
      console.warn('Multi-pass analysis failed, falling back to single-pass analyzer');
      console.warn(toErrorMessage(multiPassError));

      assertNotCancelled();
      analysisOutput = await analyzeCodeAlignment({
        documents: parsedDocs,
        codeFiles,
        structuralContext,
      });
      analysisOutput.founder_content = null;
      analysisOutput.raw_response = mergeDeterministicSignalsIntoRawResponse(
        analysisOutput.raw_response,
        deterministicSignals
      );
    }

    const lensArtifacts = generateBusinessLensArtifacts({
      architecture: analysisOutput.architecture,
      findings: analysisOutput.findings,
      documents: parsedDocs,
      projectName: project.name,
    });

    // Save results with git metadata
    const result = await createAnalysisResult({
      project_id: projectId,
      summary: analysisOutput.summary,
      findings: analysisOutput.findings,
      architecture: analysisOutput.architecture,
      capability_graph: lensArtifacts.capability_graph,
      journey_graph: lensArtifacts.journey_graph,
      quality_report: lensArtifacts.quality_report,
      founder_content: analysisOutput.founder_content || undefined,
      raw_response: analysisOutput.raw_response,
      branch: gitMetadata?.branch,
      commit_hash: gitMetadata?.commitHash,
      commit_url: gitMetadata?.commitUrl,
    });

    // Update project status
    await updateProject(projectId, { status: 'completed' });
    emit('done', 100, 'Analysis complete!');
    return { success: true, analysisId: result.id };
  } catch (error) {
    const message = toErrorMessage(error);
    await updateProject(projectId, { status: message === 'Analysis cancelled' ? 'pending' : 'failed' });
    return {
      success: false,
      error: message === 'Analysis cancelled' ? message : `Analysis failed: ${message}`,
    };
  } finally {
    if (shouldCleanupClone) {
      cleanupClone(project.id);
    }
  }
}
