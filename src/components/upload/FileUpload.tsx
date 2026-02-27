"use client";

import { useState, useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_DISPLAY,
} from "@/lib/constants";
import { EmbeddingProvider } from "@/lib/embeddings/config";
import type { Document } from "@/lib/supabase/types";
import { Upload, FileText, FileCode, File, Check, Loader2 } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: (document: Document) => void;
  onUploadError: (error: string) => void;
  embeddingProvider: EmbeddingProvider;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

export function FileUpload({
  onUploadComplete,
  onUploadError,
  embeddingProvider,
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const uploadFile = useCallback(async (file: File) => {
    setUploadingFiles((prev) => [
      ...prev,
      { file, progress: 0, status: "uploading" },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("embeddingProvider", embeddingProvider);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.duplicate) {
          throw new Error(data.error);
        }
        throw new Error(data.error || "Upload failed");
      }

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, progress: 100, status: "success" } : f
        )
      );

      onUploadComplete(data.document);

      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: "error", error: errorMessage } : f
        )
      );

      onUploadError(errorMessage);

      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.file !== file));
      }, 4000);
    }
  }, [embeddingProvider, onUploadComplete, onUploadError]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      rejectedFiles.forEach((rejection) => {
        const error = rejection.errors[0];
        if (error.code === "file-too-large") {
          onUploadError(
            `${rejection.file.name}: File exceeds ${MAX_FILE_SIZE_DISPLAY}`
          );
        } else if (error.code === "file-invalid-type") {
          onUploadError(`${rejection.file.name}: Invalid file type`);
        } else {
          onUploadError(`${rejection.file.name}: ${error.message}`);
        }
      });

      acceptedFiles.forEach((file) => {
        uploadFile(file);
      });
    },
    [onUploadError, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md", ".markdown"],
      "text/x-markdown": [".md", ".markdown"],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileText className="w-6 h-6 text-red-400" />;
      case "md":
        return <FileCode className="w-6 h-6 text-blue-400" />;
      default:
        return <File className="w-6 h-6 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-card"
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <Upload
            className={`mx-auto h-10 w-10 ${
              isDragActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
          {isDragActive ? (
            <p className="text-primary font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                <span className="font-medium text-primary hover:text-[var(--gradient-mid)]">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-sm text-muted-foreground/60">
                {ALLOWED_EXTENSIONS.join(", ")} up to {MAX_FILE_SIZE_DISPLAY}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={`${uploadingFile.file.name}-${index}`}
              className={`
                flex items-center justify-between p-3 rounded-lg
                ${uploadingFile.status === "error" ? "bg-destructive/10" : "bg-card"}
              `}
            >
              <div className="flex items-center space-x-3 min-w-0">
                {getFileIcon(uploadingFile.file.name)}
                <span className="text-sm text-foreground truncate">
                  {uploadingFile.file.name}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {uploadingFile.status === "uploading" && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {uploadingFile.status === "success" && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {uploadingFile.status === "error" && (
                  <span className={`text-sm ${
                    uploadingFile.error?.includes("already")
                      ? "text-amber-500"
                      : "text-destructive"
                  }`}>
                    {uploadingFile.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
