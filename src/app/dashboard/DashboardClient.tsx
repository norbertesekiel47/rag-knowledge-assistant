"use client";

import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "@/components/upload/FileUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import { SearchBox } from "@/components/search/SearchBox";
import type { Document } from "@/lib/supabase/types";

interface DashboardClientProps {
  initialDocuments: Document[];
}

export function DashboardClient({ initialDocuments }: DashboardClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<string | null>(null);

  // Check if any documents are pending/processing
  const hasPendingDocuments = documents.some(
    (doc) => doc.status === "pending" || doc.status === "processing"
  );

  // Fetch latest documents
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

  // Poll for updates when documents are processing
  useEffect(() => {
    if (!hasPendingDocuments) return;

    const interval = setInterval(() => {
      refreshDocuments();
    }, 2000);

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

  // Initialize Weaviate schema
  const handleSetupWeaviate = async () => {
    setSetupStatus("Initializing...");
    try {
      const response = await fetch("/api/setup/weaviate", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        setSetupStatus("✓ Weaviate schema initialized successfully!");
      } else {
        setSetupStatus(`✗ Error: ${data.error}`);
      }
    } catch (err) {
      setSetupStatus("✗ Failed to connect to setup endpoint");
    }

    setTimeout(() => setSetupStatus(null), 5000);
  };

  // Check if we have any processed documents (for showing search)
  const hasProcessedDocuments = documents.some(
    (doc) => doc.status === "processed"
  );

  return (
    <div className="space-y-8">
      {/* Setup Section */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-900">
              First-time Setup
            </h3>
            <p className="text-sm text-blue-700">
              Initialize the vector database schema (only needed once)
            </p>
          </div>
          <button
            onClick={handleSetupWeaviate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Initialize Weaviate
          </button>
        </div>
        {setupStatus && (
          <p className={`mt-2 text-sm ${setupStatus.startsWith("✓") ? "text-green-600" : setupStatus.startsWith("✗") ? "text-red-600" : "text-blue-600"}`}>
            {setupStatus}
          </p>
        )}
      </section>

      {/* Search Section */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Search Documents
        </h2>
        {hasProcessedDocuments ? (
          <SearchBox />
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-gray-600">
              Upload and process documents to enable semantic search.
            </p>
          </div>
        )}
      </section>

      {/* Upload Section */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Upload Documents
        </h2>
        <FileUpload
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </section>

      {/* Documents Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Your Documents
          </h2>
          <div className="flex items-center space-x-3">
            {hasPendingDocuments && (
              <span className="text-sm text-blue-600 flex items-center">
                <svg
                  className="w-4 h-4 mr-1 animate-spin"
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
                Processing...
              </span>
            )}
            <span className="text-sm text-gray-500">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <DocumentList documents={documents} />
      </section>
    </div>
  );
}