import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TEXT_LIMIT = 5000; // Max characters sent to AI

// Only PDF is "fully supported" — DOCX/PPTX have best-effort extraction
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'txt']);

// Correct Gemini model IDs for v1beta generateContent API
// See: https://ai.google.dev/gemini-api/docs/models
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

// ─── Text Extraction ──────────────────────────────────────────────────────────
type ExtractionResult =
  | { text: string; partial?: boolean }
  | { text: null; error: string };

async function extractText(buffer: Buffer, ext: string, mimeType: string): Promise<ExtractionResult> {

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      const text = (result.text || '').trim();
      if (text.length > 30) return { text: text.slice(0, TEXT_LIMIT) };
      return { text: null, error: 'No readable text found in this PDF. It may be scanned or image-based. Please use a text-based PDF.' };
    } catch (e: any) {
      console.error('[Summarize] PDF error:', e.message);
      return { text: null, error: 'Unable to read this PDF. Please ensure it is not corrupted.' };
    }
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────
  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const docFile = zip.file('word/document.xml');
      if (!docFile) return { text: null, error: 'This DOCX file appears corrupted or empty. Please upload a PDF instead.' };

      const xml = await docFile.async('string');
      const text = xml
        .replace(/<w:p[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 30) return { text: text.slice(0, TEXT_LIMIT), partial: true };
      return { text: null, error: 'This DOCX file does not contain readable text. Please upload a PDF.' };
    } catch (e: any) {
      console.error('[Summarize] DOCX error:', e.message);
      return { text: null, error: 'This file type is not fully supported yet. Please upload a PDF.' };
    }
  }

  // ── PPTX ─────────────────────────────────────────────────────────────────
  if (ext === 'pptx' || mimeType.includes('presentationml')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
      if (!slideFiles.length) return { text: null, error: 'No slides found in this PPTX file. Please upload a PDF.' };

      let text = '';
      for (const slide of slideFiles.slice(0, 25)) {
        const xml = await slide.async('string');
        text += xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + '\n';
      }

      const trimmed = text.trim();
      if (trimmed.length > 30) return { text: trimmed.slice(0, TEXT_LIMIT), partial: true };
      return { text: null, error: 'This PPTX file does not contain readable text. Please upload a PDF.' };
    } catch (e: any) {
      console.error('[Summarize] PPTX error:', e.message);
      return { text: null, error: 'This file type is not fully supported yet. Please upload a PDF.' };
    }
  }

  // ── TXT ──────────────────────────────────────────────────────────────────
  if (ext === 'txt' || mimeType === 'text/plain') {
    try {
      const text = buffer.toString('utf-8').trim();
      if (text.length > 30) return { text: text.slice(0, TEXT_LIMIT) };
      return { text: null, error: 'This text file is empty.' };
    } catch {
      return { text: null, error: 'Unable to read this text file.' };
    }
  }

  return { text: null, error: 'This file type is not fully supported yet. Please upload a PDF.' };
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────
async function callGemini(text: string, fileName: string, apiKey: string): Promise<object | null> {
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
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      console.log(`[Summarize] Trying model: ${model}`);
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
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Summarize] ${model} → HTTP ${res.status}`, errText.slice(0, 150));
        continue; // try next model
      }

      const body = await res.json();
      const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!raw) {
        console.warn(`[Summarize] ${model} returned empty content`);
        continue;
      }

      // Strip any markdown code fences Gemini may wrap around JSON
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      console.log(`[Summarize] ✓ Success with ${model}`);
      return parsed;

    } catch (e: any) {
      clearTimeout(timeout);
      const reason = e.name === 'AbortError' ? 'Timeout (25s)' : e.message;
      console.warn(`[Summarize] ${model} error: ${reason}`);
      continue;
    }
  }

  console.error('[Summarize] All models failed');
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError('Invalid request. Please try again.', 400);
    }

    // 2. Validate file presence
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return jsonError('No file uploaded.', 400);
    }

    // 3. Validate file is not empty
    if (file.size === 0) {
      return jsonError('The uploaded file is empty.', 400);
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return jsonError('File too large. Maximum size is 5MB.', 413);
    }

    // 5. Validate file extension
    const ext = getExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return jsonError('This file type is not fully supported yet. Please upload a PDF.', 415);
    }

    // 6. Check API key before doing any heavy work
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[Summarize] GEMINI_API_KEY not set');
      return jsonError('Unable to process document at the moment. Please try again.', 503);
    }

    // 7. Read buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return jsonError('Failed to read the uploaded file. Please try again.', 422);
    }

    // 8. Extract text
    const mimeType = file.type || '';
    console.log(`[Summarize] Processing: "${file.name}" (${file.size} bytes, ext: ${ext})`);
    const extraction = await extractText(buffer, ext, mimeType);

    // 9. Validate extracted text — do NOT call AI if text is missing
    if (extraction.text === null || extraction.text === undefined) {
      return jsonError((extraction as any).error || 'Unable to extract text from this file. Please upload a PDF.', 422);
    }

    if (extraction.text.trim().length < 30) {
      return jsonError('Not enough readable content found in this file. Please upload a text-based PDF.', 422);
    }

    console.log(`[Summarize] Extracted ${extraction.text.length} chars. Calling Gemini…`);

    // 10. Call Gemini
    const summary = await callGemini(extraction.text, file.name, apiKey);

    if (!summary) {
      return jsonError('Unable to process document. Try a smaller or different file.', 503);
    }

    // 11. Return result
    return NextResponse.json({ success: true, data: summary });

  } catch (e: any) {
    console.error('[Summarize] Unhandled crash:', e.message);
    return jsonError('Unable to process document at the moment. Please try again.', 500);
  }
}
