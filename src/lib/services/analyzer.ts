import { getProject, updateProject } from '../repositories/projects';
import { getDocumentsByProject } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { downloadRepository, cloneRepository, getRelevantFiles } from './github';
import { parseAllDocuments } from './file-parser';
import { analyzeCodeAlignment, readCodeFile } from './claude';

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

    try {
      // Try GitHub API download first (works everywhere, including Vercel)
      let downloadResult = await downloadRepository(project.github_url, project.github_token, project.id);

      // Fallback to git clone for local development if download fails
      if (!downloadResult.success) {
        console.log('GitHub API download failed, trying git clone fallback:', downloadResult.error);
        downloadResult = await cloneRepository(project.github_url, project.github_token, project.id);
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

        console.log(`Successfully downloaded repository and loaded ${codeFiles.length} code files`);
      } else {
        await updateProject(projectId, { status: 'failed' });
        return { success: false, error: downloadResult.error || 'Failed to download repository' };
      }
    } catch (error) {
      await updateProject(projectId, { status: 'failed' });
      return {
        success: false,
        error: `Failed to download repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Run Claude analysis
    const analysisOutput = await analyzeCodeAlignment({
      documents: parsedDocs,
      codeFiles,
    });

    // Save results
    const result = await createAnalysisResult({
      project_id: projectId,
      summary: analysisOutput.summary,
      findings: analysisOutput.findings,
      architecture: analysisOutput.architecture,
      raw_response: analysisOutput.raw_response,
    });

    // Update project status
    await updateProject(projectId, { status: 'completed' });

    return { success: true, analysisId: result.id };
  } catch (error) {
    await updateProject(projectId, { status: 'failed' });
    return {
      success: false,
      error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
