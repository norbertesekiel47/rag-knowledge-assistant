"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { EmbeddingProvider, DEFAULT_EMBEDDING_PROVIDER } from "@/lib/embeddings/config";

interface EmbeddingContextType {
  provider: EmbeddingProvider;
  setProvider: (p: EmbeddingProvider) => void;
}

const EmbeddingContext = createContext<EmbeddingContextType | undefined>(undefined);

export function EmbeddingProviderProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<EmbeddingProvider>(DEFAULT_EMBEDDING_PROVIDER);
  return (
    <EmbeddingContext.Provider value={{ provider, setProvider }}>
      {children}
    </EmbeddingContext.Provider>
  );
}

export function useEmbeddingProvider() {
  const ctx = useContext(EmbeddingContext);
  if (!ctx) throw new Error("useEmbeddingProvider must be used within EmbeddingProviderProvider");
  return ctx;
}
