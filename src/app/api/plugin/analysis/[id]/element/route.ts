// ABOUTME: Chrome plugin endpoint to fetch element-specific analysis data
// ABOUTME: Returns UI element details with data flow (UI → API → Database)

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getElementBySelector, getElementsByComponent } from '@/lib/repositories/elements';
import { handleCorsPrelight, withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleCorsPrelight(request)!;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return withCors(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        request
      );
    }

    const { id: analysisId } = await params;
    const { searchParams } = new URL(request.url);
    const selector = searchParams.get('selector');
    const component = searchParams.get('component');
    const file = searchParams.get('file');

    // Verify analysis exists and user owns it
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return withCors(
        NextResponse.json({ error: 'Analysis not found' }, { status: 404 }),
        request
      );
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return withCors(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        request
      );
    }

    // Find element by selector or component name
    let element = null;

    if (selector) {
      element = await getElementBySelector(analysisId, selector);
    } else if (component) {
      const elements = await getElementsByComponent(analysisId, component);
      // If multiple elements, prefer the one matching file path
      if (file) {
        element = elements.find(e => e.file_path === file) || elements[0];
      } else {
        element = elements[0];
      }
    }

    if (!element) {
      return withCors(
        NextResponse.json(
          {
            error: 'Element not found',
            message: 'This element is not in the current analysis. It may be new code added after analysis.',
          },
          { status: 404 }
        ),
        request
      );
    }

    // Build data flow response
    const dataFlow = {
      ui: {
        component: element.component_name,
        file: element.file_path,
        line: element.line_number,
        handlers: element.handlers,
      },
      api:
        element.api_calls.length > 0
          ? {
              method: element.api_calls[0].method,
              path: element.api_calls[0].path,
              file: element.api_calls[0].file,
              line: element.api_calls[0].line,
              matched: false, // TODO: Implement API matching in future task
            }
          : null,
      database: null, // TODO: Extract database info from architecture in future
    };

    return withCors(
      NextResponse.json({
        element: {
          selector: element.selector,
          component: element.component_name,
          file: element.file_path,
          line: element.line_number,
          type: element.element_type,
        },
        dataFlow,
      }),
      request
    );
  } catch (error) {
    console.error('Element data error:', error);
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch element data' },
        { status: 500 }
      ),
      request
    );
  }
}
