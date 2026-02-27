"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface Source {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  preview: string;
}

interface CitationBadgeProps {
  index: number;
  source: Source | null;
}

export function CitationBadge({ index, source }: CitationBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <sup className="inline-flex items-center justify-center ml-0.5 px-1 min-w-[1.1rem] h-4 text-[10px] font-semibold rounded-full bg-[var(--gradient-mid)]/20 text-[var(--gradient-mid)] hover:bg-[var(--gradient-mid)]/30 cursor-pointer transition-colors border border-[var(--gradient-mid)]/30">
          {index}
        </sup>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-card border border-border text-foreground p-2 space-y-1"
      >
        {source ? (
          <>
            <div className="font-medium text-xs text-[var(--gradient-mid)]">
              {source.filename}
            </div>
            <div className="text-xs text-muted-foreground">
              Chunk {source.chunkIndex + 1} &bull; {(source.score * 100).toFixed(0)}% match
            </div>
            {source.preview && (
              <div className="text-xs text-muted-foreground/70 line-clamp-2">
                {source.preview}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Source [{index}]</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
