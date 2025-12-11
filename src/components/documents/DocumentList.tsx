"use client";

import { useState } from "react";
import type { Document } from "@/lib/supabase/types";

interface DocumentListProps {
  documents: Document[];
  onDocumentDeleted?: (documentId: string) => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
  },
  processed: {
    label: "Processed",
    color: "bg-green-100 text-green-800",
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
  },
};

export function DocumentList({ documents, onDocumentDeleted }: DocumentListProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">No documents uploaded yet</p>
        <p className="text-xs text-gray-500">
          Upload PDF, TXT, or Markdown files to get started
        </p>
      </div>
    );
  }

  const handleDeleteClick = (documentId: string) => {
    if (confirmDeleteId === documentId) {
      // Second click - perform delete
      performDelete(documentId);
    } else {
      // First click - show confirmation
      setConfirmDeleteId(documentId);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const performDelete = async (documentId: string) => {
    setDeletingIds((prev) => new Set(prev).add(documentId));
    setConfirmDeleteId(null);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      onDocumentDeleted?.(documentId);
    } catch (error) {
      console.error("Delete error:", error);
      alert(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          isDeleting={deletingIds.has(document.id)}
          isConfirmingDelete={confirmDeleteId === document.id}
          onDeleteClick={() => handleDeleteClick(document.id)}
        />
      ))}
    </div>
  );
}

interface DocumentCardProps {
  document: Document;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onDeleteClick: () => void;
}

function DocumentCard({
  document,
  isDeleting,
  isConfirmingDelete,
  onDeleteClick,
}: DocumentCardProps) {
  const status = STATUS_CONFIG[document.status];
  const fileTypeColors: Record<string, string> = {
    pdf: "text-red-500",
    txt: "text-gray-500",
    md: "text-blue-500",
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`
        group flex items-center justify-between p-4 bg-white border rounded-lg
        transition-all duration-200
        ${isDeleting ? "opacity-50" : "hover:shadow-md hover:border-gray-300"}
      `}
    >
      {/* Left: File icon and info */}
      <div className="flex items-center space-x-4 min-w-0 flex-1">
        {/* File type icon */}
        <div
          className={`shrink-0 ${fileTypeColors[document.file_type] || "text-gray-400"}`}
        >
          <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="block text-center text-xs font-medium uppercase -mt-1">
            {document.file_type}
          </span>
        </div>

        {/* File details */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {document.filename}
          </h3>
          <div className="flex items-center space-x-3 mt-1">
            <span className="text-xs text-gray-500">
              {formatFileSize(document.file_size)}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              {formatDate(document.created_at)}
            </span>
            {document.status === "processed" && document.chunk_count > 0 && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {document.chunk_count} chunks
                </span>
              </>
            )}
          </div>
          {document.status === "failed" && document.error_message && (
            <p className="text-xs text-red-600 mt-1 truncate">
              {document.error_message}
            </p>
          )}
        </div>
      </div>

      {/* Right: Status badges and delete button */}
      <div className="flex items-center space-x-3 ml-4">
        {/* Status badge */}
        <span
          className={`
            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${status.color}
          `}
        >
          {document.status === "processing" && (
            <svg
              className="w-3 h-3 mr-1 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {status.label}
        </span>

        {/* Embedding provider badge */}
        <span
          className={`
            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${
              document.embedding_provider === "voyage"
                ? "bg-purple-100 text-purple-700"
                : "bg-teal-100 text-teal-700"
            }
          `}
        >
          {document.embedding_provider === "voyage" ? "Voyage" : "HuggingFace"}
        </span>

        {/* Delete button */}
        <button
          onClick={onDeleteClick}
          disabled={isDeleting || document.status === "processing"}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${
              isConfirmingDelete
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={
            isConfirmingDelete
              ? "Click again to confirm deletion"
              : document.status === "processing"
              ? "Cannot delete while processing"
              : "Delete document"
          }
        >
          {isDeleting ? (
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}