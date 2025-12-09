"use client";

import { useState } from "react";
import { FileUpload } from "@/components/upload/FileUpload";
import { DocumentList } from "@/components/documents/DocumentList";
import type { Document } from "@/lib/supabase/types";

interface DashboardClientProps {
  initialDocuments: Document[];
}

export function DashboardClient({ initialDocuments }: DashboardClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (newDocument: Document) => {
    // Add new document to the top of the list
    setDocuments((prev) => [newDocument, ...prev]);
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="space-y-8">
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
          <span className="text-sm text-gray-500">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <DocumentList documents={documents} />
      </section>
    </div>
  );
}