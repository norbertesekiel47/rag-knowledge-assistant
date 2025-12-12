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

  const uploadFile = useCallback (async (file: File) => {
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
        // Check if it's a duplicate file error
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

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className={`mx-auto h-12 w-12 ${
              isDragActive ? "text-blue-500" : "text-gray-400"
            }`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-600">
                <span className="font-medium text-blue-600 hover:text-blue-500">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-sm text-gray-500">
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
                ${uploadingFile.status === "error" ? "bg-red-50" : "bg-gray-50"}
              `}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <FileIcon
                  fileType={uploadingFile.file.name.split(".").pop() || ""}
                />
                <span className="text-sm text-gray-700 truncate">
                  {uploadingFile.file.name}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {uploadingFile.status === "uploading" && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                {uploadingFile.status === "success" && (
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {uploadingFile.status === "error" && (
                  <span className={`text-sm ${
                    uploadingFile.error?.includes("already") 
                      ? "text-amber-600" 
                      : "text-red-600"
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

function FileIcon({ fileType }: { fileType: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-500",
    txt: "text-gray-500",
    md: "text-blue-500",
  };

  return (
    <div className={`shrink-0 ${colors[fileType] || "text-gray-400"}`}>
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}