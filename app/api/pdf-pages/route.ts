// app/api/pdf-pages/route.ts
// PDF Page Editor — delete selected pages, return updated PDF as base64

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const pagesToDeleteStr = formData.get('pagesToDelete') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const pagesToDelete: number[] = pagesToDeleteStr ? JSON.parse(pagesToDeleteStr) : [];

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    console.log('[PDF Pages API] Total pages:', totalPages);
    console.log('[PDF Pages API] Pages to delete:', pagesToDelete);

    if (pagesToDelete.length === 0) {
      return NextResponse.json({ error: 'No pages selected for deletion' }, { status: 400 });
    }

    if (pagesToDelete.length >= totalPages) {
      return NextResponse.json({ error: 'Cannot delete all pages' }, { status: 400 });
    }

    // Validate page indices (0-based)
    const invalid = pagesToDelete.filter(p => p < 0 || p >= totalPages);
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid page numbers: ${invalid.join(', ')}` }, { status: 400 });
    }

    // Remove pages in reverse order (to maintain correct indices)
    const sortedDesc = Array.from(new Set(pagesToDelete)).sort((a, b) => b - a);
    for (const pageIdx of sortedDesc) {
      pdfDoc.removePage(pageIdx);
    }

    const newPageCount = pdfDoc.getPageCount();
    const pdfBytes = await pdfDoc.save();
    const base64 = Buffer.from(pdfBytes).toString('base64');

    const baseName = file.name.replace(/\.[^/.]+$/, '');

    return NextResponse.json({
      success: true,
      originalPages: totalPages,
      deletedPages: pagesToDelete.length,
      remainingPages: newPageCount,
      downloadUrl: `data:application/pdf;base64,${base64}`,
      fileName: `${baseName}_edited.pdf`,
      originalSize: fileBuffer.length,
      newSize: pdfBytes.length,
    });

  } catch (error) {
    console.error('[PDF Pages API] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'PDF editing failed',
    }, { status: 500 });
  }
}

// Get page info (page count and basic metadata)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', description: 'PDF Page Editor API — POST with file and pagesToDelete (JSON array of 0-based indices)' });
}
