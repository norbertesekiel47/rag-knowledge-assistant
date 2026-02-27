"use client";

import { useState } from "react";
import { SearchFilters, countActiveFilters } from "./SearchFilters";
import type { Document } from "@/lib/supabase/types";
import type { EmbeddingProvider } from "@/lib/embeddings/config";
import type { SearchFilters as SearchFiltersType } from "@/lib/processing/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, Loader2 } from "lucide-react";

interface SearchResult {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  chunkType?: string;
  sectionTitle?: string;
  summary?: string;
}

interface SearchBoxProps {
  documents?: Document[];
  embeddingProvider?: EmbeddingProvider;
}

export function SearchBox({ documents = [], embeddingProvider }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [searchMeta, setSearchMeta] = useState<{
    searchMethod?: string;
    reranked?: boolean;
  }>({});

  const activeFilterCount = countActiveFilters(filters);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 5,
          embeddingProvider,
          filters: activeFilterCount > 0 ? filters : undefined,
          rerank: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results);
      setSearchMeta({
        searchMethod: data.searchMethod,
        reranked: data.reranked,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                if (e.target.value.length <= 5000) setQuery(e.target.value);
              }}
              maxLength={5000}
              placeholder="Search your documents..."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
            />
            {query.length > 300 && (
              <span
                className={`text-xs shrink-0 ${
                  query.length > 4500
                    ? "text-amber-500 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {query.length.toLocaleString()}/5,000
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={`shrink-0 relative ${
            showFilters || activeFilterCount > 0
              ? "border-primary/50 text-primary bg-primary/10"
              : ""
          }`}
          title="Toggle filters"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full leading-none">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <Button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)] text-white hover:brightness-110"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <SearchFilters
          documents={documents}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </p>
            {searchMeta.searchMethod && (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">
                  via {searchMeta.searchMethod}
                </span>
                {searchMeta.reranked && (
                  <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                    re-ranked
                  </Badge>
                )}
              </div>
            )}
          </div>

          {results.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No matching documents found. Try a different search term.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <Card
                  key={`${result.documentId}-${result.chunkIndex}`}
                  className="bg-card/60 backdrop-blur-sm border-border/50"
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {result.filename}
                        </span>
                        {result.sectionTitle && (
                          <span className="text-xs text-muted-foreground">
                            &gt; {result.sectionTitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.chunkType && result.chunkType !== "paragraph" && (
                          <Badge variant="secondary" className="text-xs">
                            {result.chunkType}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Score: {(result.score * 100).toFixed(1)}% &bull; Chunk{" "}
                          {result.chunkIndex + 1}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    {result.summary && (
                      <p className="text-xs text-[var(--gradient-mid)] mb-1 italic">
                        {result.summary}
                      </p>
                    )}

                    {/* Content Preview */}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
