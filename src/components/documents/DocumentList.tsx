"use client";

import type { Document } from "@/lib/supabase/types";

interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
}

export function DocumentList({ documents, isLoading }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-16" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-3"
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
        <p>No documents yet</p>
        <p className="text-sm">Upload your first document to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}

function DocumentCard({ document }: { document: Document }) {
  const statusConfig = {
    pending: {
      color: "bg-yellow-100 text-yellow-800",
      label: "Pending",
    },
    processing: {
      color: "bg-blue-100 text-blue-800",
      label: "Processing",
    },
    processed: {
      color: "bg-green-100 text-green-800",
      label: "Ready",
    },
    failed: {
      color: "bg-red-100 text-red-800",
      label: "Failed",
    },
  };

  const status = statusConfig[document.status];

  const fileTypeColors: Record<string, string> = {
    pdf: "text-red-500 bg-red-50",
    txt: "text-gray-500 bg-gray-100",
    md: "text-blue-500 bg-blue-50",
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
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="flex items-center space-x-4 min-w-0">
        {/* File type badge */}
        <div
          className={`
            shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            font-medium text-xs uppercase
            ${fileTypeColors[document.file_type] || "text-gray-500 bg-gray-100"}
          `}
        >
          {document.file_type}
        </div>

        {/* File info */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {document.filename}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(document.file_size)} • {formatDate(document.created_at)}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center space-x-3">
        {document.status === "processed" && document.chunk_count > 0 && (
          <span className="text-xs text-gray-500">
            {document.chunk_count} chunks
          </span>
        )}
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
      </div>
    </div>
  );
}