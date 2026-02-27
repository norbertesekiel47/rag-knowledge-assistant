"use client";

import { SearchBox } from "./SearchBox";
import { useEmbeddingProvider } from "@/contexts/EmbeddingContext";
import type { Document } from "@/lib/supabase/types";

interface SearchViewProps {
  initialDocuments: Document[];
}

export function SearchView({ initialDocuments }: SearchViewProps) {
  const { provider } = useEmbeddingProvider();

  const filteredDocuments = initialDocuments.filter(
    (doc) => doc.embedding_provider === provider
  );

  const hasProcessedDocuments = filteredDocuments.length > 0;

  if (!hasProcessedDocuments) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="text-center max-w-md space-y-4">
          <h2 className="text-xl font-semibold text-foreground">No documents to search</h2>
          <p className="text-muted-foreground">
            Upload and process documents to enable semantic search.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Search</h1>
        <SearchBox
          documents={filteredDocuments}
          embeddingProvider={provider}
        />
      </div>
    </div>
  );
}
