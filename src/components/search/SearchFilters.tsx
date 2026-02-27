"use client";

import type { Document } from "@/lib/supabase/types";
import type { SearchFilters as SearchFiltersType } from "@/lib/processing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchFiltersProps {
  documents: Document[];
  filters: SearchFiltersType;
  onFiltersChange: (filters: SearchFiltersType) => void;
  compact?: boolean;
}

export function SearchFilters({
  documents,
  filters,
  onFiltersChange,
  compact = false,
}: SearchFiltersProps) {
  const processedDocs = documents.filter((d) => d.status === "processed");

  const activeCount = [
    filters.documentIds && filters.documentIds.length > 0,
    filters.fileType,
    filters.createdAfter,
    filters.createdBefore,
    filters.keyword,
  ].filter(Boolean).length;

  const clearAll = () => {
    onFiltersChange({});
  };

  const toggleDocument = (docId: string) => {
    const current = filters.documentIds || [];
    const updated = current.includes(docId)
      ? current.filter((id) => id !== docId)
      : [...current, docId];
    onFiltersChange({
      ...filters,
      documentIds: updated.length > 0 ? updated : undefined,
    });
  };

  const setFileType = (type: string | undefined) => {
    const updatedDocIds = type && filters.documentIds
      ? filters.documentIds.filter((id) =>
          processedDocs.some((doc) => doc.id === id && doc.file_type === type)
        )
      : filters.documentIds;

    onFiltersChange({
      ...filters,
      fileType: type,
      documentIds: updatedDocIds && updatedDocIds.length > 0 ? updatedDocIds : undefined,
    });
  };

  const fileTypes = [
    { value: undefined, label: "All" },
    { value: "pdf", label: "PDF" },
    { value: "md", label: "Markdown" },
    { value: "txt", label: "Text" },
  ];

  return (
    <div
      className={`bg-card border border-border rounded-lg ${compact ? "p-3" : "p-4"} space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs bg-primary/10 text-primary">
              {activeCount}
            </Badge>
          )}
        </span>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground h-auto py-1"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* File Type Filter */}
      <div>
        <label className={`block text-muted-foreground mb-1 ${compact ? "text-xs" : "text-xs font-medium"}`}>
          File Type
        </label>
        <div className="flex gap-1 flex-wrap">
          {fileTypes.map((ft) => (
            <button
              key={ft.label}
              onClick={() => setFileType(ft.value)}
              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                filters.fileType === ft.value ||
                (!filters.fileType && ft.value === undefined)
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Selector */}
      {processedDocs.length > 0 && (
        <div>
          <label className={`block text-muted-foreground mb-1 ${compact ? "text-xs" : "text-xs font-medium"}`}>
            Documents
          </label>
          <div className={`space-y-1 ${compact ? "max-h-28" : "max-h-40"} overflow-y-auto`}>
            {processedDocs
              .filter((doc) => !filters.fileType || doc.file_type === filters.fileType)
              .map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={filters.documentIds?.includes(doc.id) || false}
                  onChange={() => toggleDocument(doc.id)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="truncate">{doc.filename}</span>
                <span className="text-muted-foreground/50 ml-auto shrink-0">
                  .{doc.file_type}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Date Range */}
      <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input
            type="date"
            value={filters.createdAfter?.split("T")[0] || ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                createdAfter: e.target.value
                  ? `${e.target.value}T00:00:00Z`
                  : undefined,
              })
            }
            className="w-full px-2 py-1 text-xs bg-card border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input
            type="date"
            value={filters.createdBefore?.split("T")[0] || ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                createdBefore: e.target.value
                  ? `${e.target.value}T23:59:59Z`
                  : undefined,
              })
            }
            className="w-full px-2 py-1 text-xs bg-card border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Keyword Filter */}
      <div>
        <label className={`block text-muted-foreground mb-1 ${compact ? "text-xs" : "text-xs font-medium"}`}>
          Keyword
        </label>
        <input
          type="text"
          value={filters.keyword || ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              keyword: e.target.value || undefined,
            })
          }
          placeholder="Full-text keyword match..."
          className="w-full px-2 py-1 text-xs bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
    </div>
  );
}

/**
 * Count active filters for badge display.
 */
export function countActiveFilters(filters?: SearchFiltersType): number {
  if (!filters) return 0;
  return [
    filters.documentIds && filters.documentIds.length > 0,
    filters.fileType,
    filters.createdAfter,
    filters.createdBefore,
    filters.keyword,
  ].filter(Boolean).length;
}
