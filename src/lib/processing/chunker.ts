import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    startChar: number;
    endChar: number;
    [key: string]: unknown;
  };
}

// Configuration for chunk sizes
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

/**
 * Split document content into overlapping chunks
 */
export async function chunkDocument(
  content: string,
  documentMetadata: Record<string, unknown> = {}
): Promise<DocumentChunk[]> {
  // Handle empty content
  if (!content || content.trim().length === 0) {
    return [];
  }

  // Initialize the splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    // These separators define split priority (try first separator first)
    separators: ["\n\n", "\n", ". ", " ", ""],
    // Keep separator at end of chunk for context
    keepSeparator: true,
  });

  // Split the content
  const splits = await splitter.createDocuments(
    [content],
    [documentMetadata]
  );

  // Transform into our chunk format
  let currentPosition = 0;
  const chunks: DocumentChunk[] = splits.map((split, index) => {
    const chunkContent = split.pageContent;

    // Find where this chunk starts in the original content
    const startChar = content.indexOf(chunkContent, currentPosition);
    const endChar = startChar + chunkContent.length;

    // Update position for next search (accounting for overlap)
    currentPosition = Math.max(0, startChar + chunkContent.length - CHUNK_OVERLAP);

    return {
      content: chunkContent,
      chunkIndex: index,
      metadata: {
        startChar: startChar >= 0 ? startChar : currentPosition,
        endChar: endChar,
        ...split.metadata,
      },
    };
  });

  return chunks;
}

/**
 * Get chunking configuration (useful for debugging/display)
 */
export function getChunkingConfig() {
  return {
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  };
}