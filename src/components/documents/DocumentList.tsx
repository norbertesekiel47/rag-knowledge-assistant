"use client";

import { useState } from "react";
import type { Document } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, FileCode, File, Trash2, Loader2 } from "lucide-react";

interface DocumentListProps {
  documents: Document[];
  onDocumentDeleted?: (documentId: string) => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  processed: {
    label: "Processed",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function DocumentList({ documents, onDocumentDeleted }: DocumentListProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No documents uploaded yet</p>
        <p className="text-xs text-muted-foreground/60">
          Upload PDF, TXT, or Markdown files to get started
        </p>
      </div>
    );
  }

  const handleDeleteClick = (documentId: string) => {
    if (confirmDeleteId === documentId) {
      performDelete(documentId);
    } else {
      setConfirmDeleteId(documentId);
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

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return <FileText className="w-8 h-8 text-red-400" />;
      case "md":
        return <FileCode className="w-8 h-8 text-blue-400" />;
      default:
        return <File className="w-8 h-8 text-muted-foreground" />;
    }
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
    <div className="space-y-3">
      {documents.map((document) => {
        const status = STATUS_CONFIG[document.status];
        const isDeleting = deletingIds.has(document.id);
        const isConfirmingDelete = confirmDeleteId === document.id;

        return (
          <Card
            key={document.id}
            className={`group flex items-center justify-between p-4 bg-card/60 backdrop-blur-sm border-border/50 transition-all duration-200 ${
              isDeleting ? "opacity-50" : "hover:border-border"
            }`}
          >
            {/* Left: File icon and info */}
            <div className="flex items-center space-x-4 min-w-0 flex-1">
              <div className="shrink-0">
                {getFileIcon(document.file_type)}
                <span className="block text-center text-[10px] font-medium uppercase text-muted-foreground -mt-1">
                  {document.file_type}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {document.filename}
                </h3>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(document.file_size)}
                  </span>
                  <span className="text-xs text-muted-foreground/40">&bull;</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(document.created_at)}
                  </span>
                  {document.status === "processed" && document.chunk_count > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground/40">&bull;</span>
                      <span className="text-xs text-muted-foreground">
                        {document.chunk_count} chunks
                      </span>
                    </>
                  )}
                </div>
                {document.status === "failed" && document.error_message && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    {document.error_message}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Status badges and delete button */}
            <div className="flex items-center space-x-3 ml-4">
              <Badge variant="outline" className={`text-xs ${status.className}`}>
                {document.status === "processing" && (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                )}
                {status.label}
              </Badge>

              <Badge
                variant="outline"
                className={`text-xs ${
                  document.embedding_provider === "voyage"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                }`}
              >
                {document.embedding_provider === "voyage" ? "Voyage" : "HuggingFace"}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteClick(document.id)}
                disabled={isDeleting || document.status === "processing"}
                className={`h-8 w-8 ${
                  isConfirmingDelete
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                }`}
                title={
                  isConfirmingDelete
                    ? "Click again to confirm deletion"
                    : document.status === "processing"
                    ? "Cannot delete while processing"
                    : "Delete document"
                }
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
