import { extractTextWithOCR } from './edenaiProxyService';

export type FileParsingMethod = 'direct_text' | 'ocr';

export interface FileDetectionResult {
  method: FileParsingMethod;
  extractedText: string;
  confidence: number;
  isImageBased: boolean;
  pageCount?: number;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'];
const TEXT_EXTENSIONS = ['txt', 'md'];
const DOCX_EXTENSIONS = ['docx', 'doc'];

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/');
}

function isTextFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return TEXT_EXTENSIONS.includes(ext) || file.type === 'text/plain';
}

function isDocxFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return DOCX_EXTENSIONS.includes(ext) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

async function extractTextFromPdfDirect(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  return { text: textParts.join('\n\n'), pageCount };
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function assessTextQuality(text: string): { isUsable: boolean; confidence: number } {
  if (!text || text.trim().length < 50) {
    return { isUsable: false, confidence: 0 };
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const wordCount = cleaned.split(' ').length;
  const alphaRatio = (cleaned.match(/[a-zA-Z]/g) || []).length / cleaned.length;
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(cleaned);
  const hasPhone = /[\+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{4,6}/.test(cleaned);
  const hasSectionHeaders = /\b(experience|education|skills|projects|summary|objective)\b/i.test(cleaned);
  const garbageRatio = (cleaned.match(/[^\x20-\x7E\n]/g) || []).length / cleaned.length;

  let confidence = 0;
  if (wordCount > 50) confidence += 30;
  else if (wordCount > 20) confidence += 15;

  if (alphaRatio > 0.6) confidence += 25;
  else if (alphaRatio > 0.4) confidence += 10;

  if (hasEmail) confidence += 10;
  if (hasPhone) confidence += 5;
  if (hasSectionHeaders) confidence += 20;

  if (garbageRatio > 0.3) confidence -= 30;
  if (garbageRatio > 0.5) confidence -= 20;

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    isUsable: confidence >= 40 && wordCount >= 20 && garbageRatio < 0.4,
    confidence,
  };
}

export async function detectAndExtractText(file: File): Promise<FileDetectionResult> {
  if (isImageFile(file)) {
    const extractedText = await extractTextWithOCR(file);
    return {
      method: 'ocr',
      extractedText,
      confidence: 80,
      isImageBased: true,
    };
  }

  if (isTextFile(file)) {
    const text = await file.text();
    return {
      method: 'direct_text',
      extractedText: text,
      confidence: 95,
      isImageBased: false,
    };
  }

  if (isDocxFile(file)) {
    const text = await extractTextFromDocx(file);
    const quality = assessTextQuality(text);
    return {
      method: 'direct_text',
      extractedText: text,
      confidence: quality.confidence,
      isImageBased: false,
    };
  }

  if (file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf') {
    try {
      const { text, pageCount } = await extractTextFromPdfDirect(file);
      const quality = assessTextQuality(text);

      if (quality.isUsable) {
        return {
          method: 'direct_text',
          extractedText: text,
          confidence: quality.confidence,
          isImageBased: false,
          pageCount,
        };
      }

      const ocrText = await extractTextWithOCR(file);
      return {
        method: 'ocr',
        extractedText: ocrText,
        confidence: 75,
        isImageBased: true,
        pageCount,
      };
    } catch {
      const ocrText = await extractTextWithOCR(file);
      return {
        method: 'ocr',
        extractedText: ocrText,
        confidence: 70,
        isImageBased: true,
      };
    }
  }

  const ocrText = await extractTextWithOCR(file);
  return {
    method: 'ocr',
    extractedText: ocrText,
    confidence: 60,
    isImageBased: true,
  };
}
