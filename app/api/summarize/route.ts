import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024;   // 5 MB hard limit
const TEXT_PREVIEW  = 5000;              // characters sent to AI
const MIN_TEXT_LEN  = 50;               // minimum chars to consider readable

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<
  { text: string } | { error: string }
> {
  return new Promise((resolve) => {
    try {
      console.log('[Summarize] Starting text extraction with pdf2json...');
      
      // Instantiate parser (null, 1) means we want the raw text content
      const pdfParser = new (PDFParser as any)(null, 1);

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('[Summarize] pdf2json error:', errData.parserError);
        resolve({
          error: 'Unable to read this PDF. The file may be password-protected or uses an unsupported format.',
        });
      });

      pdfParser.on('pdfParser_dataReady', () => {
        const text = (pdfParser.getRawTextContent() || '').trim();
        
        if (text.length < MIN_TEXT_LEN) {
          console.warn('[Summarize] No readable text found in PDF');
          resolve({
            error: 'This PDF does not contain enough extractable text. It might be an image-only scan.',
          });
          return;
        }

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        console.log(`[Summarize] Extracted ${cleanedText.length} characters successfully`);
        resolve({ text: cleanedText.slice(0, TEXT_PREVIEW) });
      });

      pdfParser.parseBuffer(buffer);
    } catch (err: any) {
      console.error('[Summarize] PDF extraction error:', err.message);
      resolve({
        error: 'An internal error occurred while reading the PDF.',
      });
    }
  });
}

// ─── Gemini Call ──────────────────────────────────────────────────────────────
async function callGemini(
  text: string,
  fileName: string,
  apiKey: string,
): Promise<object | null> {
  const prompt = `You are a document analyst. Summarize the following document content from "${fileName}".

Return ONLY a valid JSON object with exactly these fields (no markdown, no code fences):
{
  "title": "concise document title",
  "overview": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "highlights": [{"label": "Category", "value": "Detail"}]
}

Document content:
${text}`;

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28_000);

    try {
      console.log(`[Summarize] Calling model: ${model}`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`[Summarize] ${model} HTTP ${res.status}:`, errBody.slice(0, 200));
        continue;
      }

      const body = await res.json();
      const raw: string = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!raw) {
        console.warn(`[Summarize] ${model} returned empty content`);
        continue;
      }

      // Strip markdown code fences Gemini sometimes wraps around JSON
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      console.log(`[Summarize] ✓ Success with ${model}`);
      return parsed;
    } catch (err: any) {
      clearTimeout(timer);
      const reason = err.name === 'AbortError' ? 'Timeout (28s)' : err.message;
      console.warn(`[Summarize] ${model} failed: ${reason}`);
    }
  }

  console.error('[Summarize] All Gemini models failed');
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Parse multipart form ──────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError('Invalid request format. Please try again.', 400);
    }

    // ── 2. Validate file presence ────────────────────────────────────────────
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return jsonError('No file uploaded. Please select a PDF.', 400);
    }

    // ── 3. Validate not empty ────────────────────────────────────────────────
    if (file.size === 0) {
      return jsonError('The uploaded file is empty.', 400);
    }

    // ── 4. Validate file size ────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      return jsonError('File too large. Maximum allowed size is 5MB.', 413);
    }

    // ── 5. Validate PDF only ─────────────────────────────────────────────────
    const ext = getExtension(file.name);
    const mime = file.type || '';
    const isPdf = ext === 'pdf' || mime === 'application/pdf';
    if (!isPdf) {
      return jsonError(
        'Only PDF files are supported at this time. Please upload a .pdf file.',
        415,
      );
    }

    // ── 6. Check API key early ───────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      console.error('[Summarize] GEMINI_API_KEY is missing');
      return jsonError(
        'AI service is temporarily unavailable. Please try again later.',
        503,
      );
    }

    // ── 7. Read buffer ───────────────────────────────────────────────────────
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return jsonError('Failed to read the uploaded file. Please try again.', 422);
    }

    console.log(
      `[Summarize] Processing "${file.name}" — ${(file.size / 1024).toFixed(1)} KB`,
    );

    // ── 8. Extract text ──────────────────────────────────────────────────────
    const extraction = await extractPdfText(buffer);

    if ('error' in extraction) {
      return jsonError(extraction.error, 422);
    }

    const { text } = extraction;

    if (text.trim().length < MIN_TEXT_LEN) {
      return jsonError(
        'Not enough readable content found. Please upload a text-based PDF.',
        422,
      );
    }

    console.log(`[Summarize] Sending ${text.length} chars to Gemini…`);

    // ── 9. Call Gemini ───────────────────────────────────────────────────────
    const summary = await callGemini(text, file.name, apiKey);

    if (!summary) {
      return jsonError(
        'Unable to generate summary at this time. Please try a smaller or different PDF.',
        503,
      );
    }

    // ── 10. Return success ───────────────────────────────────────────────────
    return NextResponse.json({ success: true, data: summary });

  } catch (err: any) {
    // Absolute last-resort catch — server must never return a raw 500 crash
    console.error('[Summarize] Unhandled exception:', err.message);
    return jsonError(
      'An unexpected error occurred. Please try again.',
      500,
    );
  }
}
