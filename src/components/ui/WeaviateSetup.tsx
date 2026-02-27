"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, Zap, Loader2, Database } from "lucide-react";

interface WeaviateStatus {
  initialized: boolean;
  v2Initialized: boolean;
  collections: {
    voyage: boolean;
    huggingface: boolean;
    voyageV2: boolean;
    huggingfaceV2: boolean;
  };
}

export function WeaviateSetup() {
  const [status, setStatus] = useState<WeaviateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/setup/weaviate");

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError("Failed to check status");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      const response = await fetch("/api/setup/weaviate", {
        method: "POST",
      });

      if (response.ok) {
        await checkStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Initialization failed");
      }
    } catch {
      setError("Failed to initialize");
    } finally {
      setIsInitializing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Checking vector database status...</span>
        </div>
      </div>
    );
  }

  // Already initialized
  if (status?.initialized) {
    const allV2Ready = status.v2Initialized;
    return (
      <div className={`border rounded-lg p-4 ${allV2Ready ? "bg-green-500/10 border-green-500/20" : "bg-primary/10 border-primary/20"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${allV2Ready ? "bg-green-500/20" : "bg-primary/20"}`}>
              <Check className={`w-5 h-5 ${allV2Ready ? "text-green-400" : "text-primary"}`} />
            </div>
            <div>
              <h3 className={`text-sm font-medium ${allV2Ready ? "text-green-400" : "text-primary"}`}>
                {allV2Ready ? "Vector Database Ready (V2)" : "Vector Database Ready (V1 only)"}
              </h3>
              <p className={`text-xs ${allV2Ready ? "text-green-400/70" : "text-primary/70"}`}>
                {allV2Ready
                  ? "Enriched V2 collections active — smart chunking & metadata enabled"
                  : "V1 collections ready. Click Initialize to upgrade to V2."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Badge variant="secondary" className={status.collections.voyage ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted text-muted-foreground"}>
              Voyage V1 {status.collections.voyage ? "✓" : "✗"}
            </Badge>
            <Badge variant="secondary" className={status.collections.huggingface ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted text-muted-foreground"}>
              HF V1 {status.collections.huggingface ? "✓" : "✗"}
            </Badge>
            <Badge variant="secondary" className={status.collections.voyageV2 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
              Voyage V2 {status.collections.voyageV2 ? "✓" : "✗"}
            </Badge>
            <Badge variant="secondary" className={status.collections.huggingfaceV2 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
              HF V2 {status.collections.huggingfaceV2 ? "✓" : "✗"}
            </Badge>
          </div>
        </div>
        {!allV2Ready && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              onClick={handleInitialize}
              disabled={isInitializing}
              className="bg-primary hover:bg-primary/90 text-white text-xs"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Upgrading...
                </>
              ) : "Upgrade to V2"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Not initialized - show setup button
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-amber-400">
              First-time Setup Required
            </h3>
            <p className="text-xs text-amber-400/70">
              Initialize the vector database to enable document search
            </p>
          </div>
        </div>

        <Button
          onClick={handleInitialize}
          disabled={isInitializing}
          className="bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] hover:opacity-90 text-white"
        >
          {isInitializing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Initialize Weaviate
            </>
          )}
        </Button>
      </div>

      {/* Show partial status if any collection exists */}
      {status && (status.collections.voyage || status.collections.huggingface) && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <Badge variant="secondary" className={status.collections.voyage ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted text-muted-foreground"}>
            Voyage V1 {status.collections.voyage ? "✓" : "✗"}
          </Badge>
          <Badge variant="secondary" className={status.collections.huggingface ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted text-muted-foreground"}>
            HF V1 {status.collections.huggingface ? "✓" : "✗"}
          </Badge>
          <Badge variant="secondary" className={status.collections?.voyageV2 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
            Voyage V2 {status.collections?.voyageV2 ? "✓" : "✗"}
          </Badge>
          <Badge variant="secondary" className={status.collections?.huggingfaceV2 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
            HF V2 {status.collections?.huggingfaceV2 ? "✓" : "✗"}
          </Badge>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
