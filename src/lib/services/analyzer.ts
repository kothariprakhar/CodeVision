import { getProject, updateProjectStatus } from '../repositories/projects';
import { getProjectDocuments } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { cloneRepository, cleanupClone, getRelevantFiles } from './github';
import { parseAllDocuments } from './file-parser';
import { analyzeCodeAlignment, readCodeFile } from './claude';

export interface AnalyzeProjectResult {
  success: boolean;
  error?: string;
  analysisId?: string;
}

export async function analyzeProject(projectId: string): Promise<AnalyzeProjectResult> {
  const project = getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const documents = getProjectDocuments(projectId);
  if (documents.length === 0) {
    return { success: false, error: 'No documents uploaded. Please upload requirements documents first.' };
  }

  let clonePath: string | null = null;

  try {
    // Update status to analyzing
    updateProjectStatus(projectId, 'analyzing');

    // Delete previous analysis if exists
    deleteProjectAnalysis(projectId);

    // Clone the repository
    const cloneResult = await cloneRepository(project.github_url, project.github_token);
    if (!cloneResult.success || !cloneResult.path) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: cloneResult.error || 'Failed to clone repository' };
    }
    clonePath = cloneResult.path;

    // Parse all uploaded documents
    const documentPaths = documents.map(doc => doc.file_path);
    const parsedDocs = await parseAllDocuments(documentPaths);

    if (parsedDocs.length === 0) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: 'Failed to parse any documents' };
    }

    // Get relevant code files
    const relevantFiles = getRelevantFiles(clonePath);
    if (relevantFiles.length === 0) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: 'No source code files found in repository' };
    }

    // Read code file contents
    const codeFiles = relevantFiles.map(filePath => ({
      path: filePath,
      content: readCodeFile(clonePath!, filePath),
    }));

    // Run Claude analysis
    const analysisOutput = await analyzeCodeAlignment({
      documents: parsedDocs,
      codeFiles,
    });

    // Save results
    const result = createAnalysisResult({
      project_id: projectId,
      summary: analysisOutput.summary,
      findings: analysisOutput.findings,
      architecture: analysisOutput.architecture,
      raw_response: analysisOutput.raw_response,
    });

    // Update project status
    updateProjectStatus(projectId, 'completed');

    return { success: true, analysisId: result.id };
  } catch (error) {
    updateProjectStatus(projectId, 'failed');
    return {
      success: false,
      error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    // Always clean up cloned repo
    if (clonePath) {
      cleanupClone(clonePath);
    }
  }
}
