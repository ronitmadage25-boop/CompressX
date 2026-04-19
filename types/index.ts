// types/index.ts
// Vercel-compatible types (video support removed)

export type SupportedFileType = 'image' | 'pdf' | 'docx' | 'pptx';

export type CompressionStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'compressing'
  | 'optimizing'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface CompressionJob {
  id: string;
  fileName: string;
  originalName: string;
  fileType: SupportedFileType;
  mimeType: string;
  originalSize: number;
  targetSize: number;        // bytes
  compressedSize?: number;
  compressionRatio?: number; // percent saved
  status: CompressionStatus;
  progress: number;          // 0–100
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  tempPath?: string;
  outputPath?: string;
  metadata?: Record<string, unknown>;
  steps: CompressionStep[];
  iterations?: number;       // how many binary-search rounds
}

export interface CompressionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  startedAt?: Date;
  completedAt?: Date;
  detail?: string;
}

export interface CompressionRequest {
  fileId: string;
  targetBytes: number;
  options?: CompressionOptions;
}

export interface CompressionOptions {
  // Image
  imageFormat?: 'jpeg' | 'webp' | 'png';
  preserveExif?: boolean;
  // PDF
  pdfImageQuality?: number;
  pdfVersion?: string;
  // Office
  stripMedia?: boolean;
  stripThumbnails?: boolean;
}

export interface CompressionResult {
  jobId: string;
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  iterations: number;
  timeTakenMs: number;
  downloadUrl: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface UploadResponse {
  fileId: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
  fileType: SupportedFileType;
}

export interface ProgressEvent {
  jobId: string;
  status: CompressionStatus;
  progress: number;
  step?: string;
  detail?: string;
}

export interface DashboardStats {
  totalFilesCompressed: number;
  totalBytesSaved: number;
  averageCompressionRatio: number;
  sessionJobs: CompressionJob[];
}
