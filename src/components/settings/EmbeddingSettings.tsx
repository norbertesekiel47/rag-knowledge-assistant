"use client";

import { useState } from "react";
import {
  EmbeddingProvider,
  EMBEDDING_CONFIGS,
  DEFAULT_EMBEDDING_PROVIDER,
} from "@/lib/embeddings/config";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Brain, ChevronDown, Check } from "lucide-react";

interface EmbeddingSettingsProps {
  currentProvider: EmbeddingProvider;
  onProviderChange: (provider: EmbeddingProvider) => void;
}

export function EmbeddingSettings({
  currentProvider,
  onProviderChange,
}: EmbeddingSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center space-x-3">
          <Brain className="w-5 h-5 text-[var(--gradient-mid)]" />
          <div>
            <h3 className="text-sm font-medium text-foreground">Embedding Model</h3>
            <p className="text-xs text-muted-foreground">
              {EMBEDDING_CONFIGS[currentProvider].model}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Info Banner */}
          <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Note:</strong> Documents are indexed per embedding model.
              Switching models will show only documents processed with that model.
            </p>
          </div>

          {/* Provider Options */}
          <div className="space-y-3">
            {(Object.keys(EMBEDDING_CONFIGS) as EmbeddingProvider[]).map((provider) => {
              const config = EMBEDDING_CONFIGS[provider];
              const isSelected = currentProvider === provider;

              return (
                <div
                  key={provider}
                  onClick={() => onProviderChange(provider)}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-border/80"
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-foreground">
                          {provider === "voyage" ? "Voyage AI" : "Hugging Face"}
                        </h4>
                        {provider === DEFAULT_EMBEDDING_PROVIDER && (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {config.model}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {config.dimensions} dimensions
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">{config.description}</p>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Limitations:
                    </p>
                    <ul className="text-xs text-muted-foreground/60 space-y-1">
                      {config.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-muted-foreground/40 mr-1">&bull;</span>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
