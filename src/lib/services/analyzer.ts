import { getProject, updateProject } from '../repositories/projects';
import { getDocumentsByProject } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { cloneRepository, getRelevantFiles } from './github';
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

    // Clone the repository
    const cloneResult = await cloneRepository(project.github_url, project.github_token, project.id);
    if (!cloneResult.success || !cloneResult.path) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: cloneResult.error || 'Failed to clone repository' };
    }

    const clonePath = cloneResult.path;

    // Parse all uploaded documents
    const documentPaths = documents.map(doc => doc.file_path);
    const parsedDocs = await parseAllDocuments(documentPaths);

    if (parsedDocs.length === 0) {
      await updateProject(projectId, { status: 'failed' });
      return { success: false, error: 'Failed to parse any documents' };
    }

    // Get relevant code files
    const relevantFiles = getRelevantFiles(clonePath);
    if (relevantFiles.length === 0) {
      await updateProject(projectId, { status: 'failed' });
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
