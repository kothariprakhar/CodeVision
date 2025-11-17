import fs from 'fs';
import path from 'path';

export interface ParsedDocument {
  filename: string;
  type: 'pdf' | 'markdown' | 'text' | 'image';
  content: string; // For text-based, this is the text. For images, base64.
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const absolutePath = path.join(process.cwd(), filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (ext === '.pdf') {
    // Dynamic import to avoid build-time canvas dependency issues
    const pdfParse = await import('pdf-parse');
    const { PDFParse } = pdfParse;
    const buffer = fs.readFileSync(absolutePath);
    const pdfParser = new PDFParse({ data: buffer });
    const data = await pdfParser.getText();
    return {
      filename,
      type: 'pdf',
      content: data.text,
    };
  }

  if (ext === '.md' || ext === '.markdown') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      filename,
      type: 'markdown',
      content,
    };
  }

  if (ext === '.txt') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      filename,
      type: 'text',
      content,
    };
  }

  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString('base64');
    const mimeType = getMimeType(ext);
    return {
      filename,
      type: 'image',
      content: `data:${mimeType};base64,${base64}`,
    };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function parseAllDocuments(filePaths: string[]): Promise<ParsedDocument[]> {
  const results: ParsedDocument[] = [];

  for (const filePath of filePaths) {
    try {
      const parsed = await parseDocument(filePath);
      results.push(parsed);
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      // Continue with other documents
    }
  }

  return results;
}
