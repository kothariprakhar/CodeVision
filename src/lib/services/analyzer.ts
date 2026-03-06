import { getProject, updateProject } from '../repositories/projects';
import { getDocumentsByProject } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { downloadRepository, cloneRepository, getRelevantFiles, extractGitMetadata } from './github';
import { parseAllDocuments } from './file-parser';
import { analyzeCodeAlignment, readCodeFile } from './claude';
import { generateBusinessLensArtifacts } from './lenses';

export interface AnalyzeProjectResult {
  success: boolean;
  error?: string;
  analysisId?: string;
}

export async function analyzeProject(projectId: string): Promise<AnalyzeProjectResult> {
  const project = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const documents = await getDocumentsByProject(projectId);
  if (documents.length === 0) {
    return { success: false, error: 'No documents uploaded. Please upload requirements documents first.' };
  }

  try {
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

    // Download the repository using GitHub API (works on serverless)
    let codeFiles: { path: string; content: string }[] = [];

    // Try GitHub API download first (works everywhere, including Vercel)
    let downloadResult = await downloadRepository(project.github_url, project.github_token, project.id);

    // Fallback to git clone for local development if download fails
    if (!downloadResult.success) {
      console.log('GitHub API download failed:', downloadResult.error);
      console.log('Attempting git clone fallback (may fail on serverless)...');

      try {
        downloadResult = await cloneRepository(project.github_url, project.github_token, project.id);
        console.log('Git clone fallback successful');
      } catch (gitError) {
        console.warn('Git clone fallback failed (expected on serverless environments)');
        console.warn('Original GitHub API error:', downloadResult.error);
        await updateProject(projectId, { status: 'failed' });
        return {
          success: false,
          error: `Failed to download repository via GitHub API: ${downloadResult.error}`,
        };
      }
    }

    if (downloadResult.success && downloadResult.path) {
      const repoPath = downloadResult.path;

      // Get relevant code files
      const relevantFiles = getRelevantFiles(repoPath);

      if (relevantFiles.length === 0) {
        await updateProject(projectId, { status: 'failed' });
        return { success: false, error: 'No source code files found in repository' };
      }

      // Read code file contents
      codeFiles = relevantFiles.map(filePath => ({
        path: filePath,
        content: readCodeFile(repoPath, filePath),
      }));

      // NEW: Extract git metadata
      const gitMetadata = await extractGitMetadata(repoPath, project.github_url);

      console.log(`Successfully downloaded repository and loaded ${codeFiles.length} code files`);
      console.log('Git metadata:', gitMetadata);

      // Run Claude analysis
      const analysisOutput = await analyzeCodeAlignment({
        documents: parsedDocs,
        codeFiles,
      });

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
        raw_response: analysisOutput.raw_response,
        branch: gitMetadata?.branch,           // NEW
        commit_hash: gitMetadata?.commitHash,   // NEW
        commit_url: gitMetadata?.commitUrl,     // NEW
      });

      // Update project status
      await updateProject(projectId, { status: 'completed' });

      return { success: true, analysisId: result.id };
    } else {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: downloadResult.error || 'Failed to download repository' };
    }
  } catch (error) {
    await updateProject(projectId, { status: 'failed' });
    return {
      success: false,
      error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
