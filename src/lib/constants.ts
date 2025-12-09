// File upload constraints
export const ALLOWED_FILE_TYPES = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const MAX_FILE_SIZE_DISPLAY = "10MB";

export const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"] as const;

// Helper to check if a MIME type is allowed
export function isAllowedMimeType(
  mimeType: string
): mimeType is keyof typeof ALLOWED_FILE_TYPES {
  return mimeType in ALLOWED_FILE_TYPES;
}

// Helper to get file type from MIME type
export function getFileType(mimeType: string): string | null {
  if (isAllowedMimeType(mimeType)) {
    return ALLOWED_FILE_TYPES[mimeType];
  }
  return null;
}