"use client";

import { useState } from "react";

interface SearchResult {
  content: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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
        body: JSON.stringify({ query, limit: 5 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results);
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
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your documents..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>

          {results.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No matching documents found. Try a different search term.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={`${result.documentId}-${result.chunkIndex}`}
                  className="p-4 bg-white border border-gray-200 rounded-lg"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {result.filename}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: {(result.score * 100).toFixed(1)}% • Chunk {result.chunkIndex + 1}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}