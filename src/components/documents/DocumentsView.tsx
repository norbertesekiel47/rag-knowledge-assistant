"use client";

import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "@/components/upload/FileUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import { EmbeddingSettings } from "@/components/settings/EmbeddingSettings";
import { useEmbeddingProvider } from "@/contexts/EmbeddingContext";
import { WeaviateSetup } from "@/components/ui/WeaviateSetup";
import type { Document } from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

interface DocumentsViewProps {
  initialDocuments: Document[];
}

export function DocumentsView({ initialDocuments }: DocumentsViewProps) {
  const { provider, setProvider } = useEmbeddingProvider();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);

  const hasPendingDocuments = documents.some(
    (doc) => doc.status === "pending" || doc.status === "processing"
  );

  const filteredDocuments = documents.filter(
    (doc) => doc.embedding_provider === provider
  );

  const handleDocumentDeleted = (documentId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
  };

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error("Failed to refresh documents:", err);
    }
  }, []);

  useEffect(() => {
    if (!hasPendingDocuments) return;
    const interval = setInterval(refreshDocuments, 2000);
    return () => clearInterval(interval);
  }, [hasPendingDocuments, refreshDocuments]);

  const handleUploadComplete = (newDocument: Document) => {
    setDocuments((prev) => [newDocument, ...prev]);
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <span className="text-sm text-muted-foreground">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""}
            {filteredDocuments.length !== documents.length && (
              <span className="text-muted-foreground/60"> ({documents.length} total)</span>
            )}
          </span>
        </div>

        {/* Weaviate setup (shown only if needed) */}
        <WeaviateSetup />

        {/* Embedding Settings */}
        <EmbeddingSettings
          currentProvider={provider}
          onProviderChange={setProvider}
        />

        {/* Upload Section */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Upload Documents</h2>
          <FileUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            embeddingProvider={provider}
          />
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </section>

        {/* Documents List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Your Documents</h2>
            {hasPendingDocuments && (
              <span className="text-sm text-primary flex items-center">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Processing...
              </span>
            )}
          </div>
          <DocumentList
            documents={filteredDocuments}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </section>
      </div>
    </div>
  );
}
