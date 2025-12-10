// File upload constraints
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const MAX_FILE_SIZE_DISPLAY = "10MB";

export const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"] as const;

// Map extensions to file types
export const EXTENSION_TO_TYPE: Record<string, string> = {
  ".pdf": "pdf",
  ".txt": "txt",
  ".md": "md",
  ".markdown": "md",
};

// Helper to check if a MIME type is allowed
export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

// Helper to get file type from MIME type
export function getFileTypeFromMime(mimeType: string): string | null {
  return ALLOWED_FILE_TYPES[mimeType] || null;
}

// Helper to get file type from extension
export function getFileTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  return EXTENSION_TO_TYPE[ext] || null;
}

// Combined helper: try MIME type first, then fall back to extension
export function getFileType(mimeType: string, filename: string): string | null {
  // First try MIME type
  const fromMime = getFileTypeFromMime(mimeType);
  if (fromMime) return fromMime;

  // Fall back to extension
  const fromExtension = getFileTypeFromExtension(filename);
  if (fromExtension) return fromExtension;

  return null;
}

// Check if file is allowed (by MIME type OR extension)
export function isAllowedFile(mimeType: string, filename: string): boolean {
  return getFileType(mimeType, filename) !== null;
}