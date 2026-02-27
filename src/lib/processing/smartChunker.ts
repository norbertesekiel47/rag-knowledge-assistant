import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type {
  StructuredDocument,
  StructuredSection,
  PreEnrichmentChunk,
  SmartChunkOptions,
  ChunkType,
} from "./types";

const DEFAULT_TARGET_TOKENS = 400;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_OVERLAP_TOKENS = 50;

// Rough estimate: 1 token ≈ 4 characters (conservative for English text)
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text using a simple heuristic.
 * Accurate enough for chunking decisions without needing a tokenizer.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

/**
 * Smart chunker that respects document structure.
 *
 * Rules:
 * 1. Tables are never split — each table is its own chunk
 * 2. Code blocks are never split — each code block is its own chunk
 * 3. Headings are always grouped with the content below them
 * 4. Lists stay together if under token target; split at item boundaries if over
 * 5. Paragraphs merge under same heading until target token count is reached
 * 6. Oversized sections fall back to RecursiveCharacterTextSplitter
 */
export async function chunkStructuredDocument(
  doc: StructuredDocument,
  options?: SmartChunkOptions
): Promise<PreEnrichmentChunk[]> {
  const targetTokens = options?.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const chunks: PreEnrichmentChunk[] = [];
  let chunkIndex = 0;

  // Group sections by heading context
  const groups = groupSectionsByHeading(doc.sections);

  for (const group of groups) {
    const groupChunks = await chunkSectionGroup(
      group,
      targetTokens,
      maxTokens,
      overlapTokens,
      doc.rawContent
    );

    for (const chunk of groupChunks) {
      chunk.chunkIndex = chunkIndex++;
      chunks.push(chunk);
    }
  }

  return chunks;
}

interface SectionGroup {
  heading: string;
  headingContent?: string;
  sections: StructuredSection[];
}

/**
 * Group consecutive sections under their nearest heading.
 */
function groupSectionsByHeading(sections: StructuredSection[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentGroup: SectionGroup = {
    heading: "Introduction",
    sections: [],
  };

  for (const section of sections) {
    if (section.type === "heading") {
      // Start a new group if current group has content
      if (currentGroup.sections.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        heading: section.content,
        headingContent: section.content,
        sections: [],
      };
    } else {
      currentGroup.sections.push(section);
    }
  }

  // Push the last group
  if (currentGroup.sections.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Chunk a group of sections that share the same heading context.
 */
async function chunkSectionGroup(
  group: SectionGroup,
  targetTokens: number,
  maxTokens: number,
  overlapTokens: number,
  rawContent: string
): Promise<PreEnrichmentChunk[]> {
  const chunks: PreEnrichmentChunk[] = [];
  let accumulatedContent = "";
  let accumulatedType: ChunkType = "paragraph";

  const flush = () => {
    const content = accumulatedContent.trim();
    if (!content) return;

    const startChar = rawContent.indexOf(content);
    chunks.push({
      content,
      chunkIndex: 0, // Will be set by caller
      chunkType: accumulatedType,
      sectionTitle: group.heading,
      metadata: {
        startChar: startChar >= 0 ? startChar : 0,
        endChar: startChar >= 0 ? startChar + content.length : content.length,
      },
    });
    accumulatedContent = "";
    accumulatedType = "paragraph";
  };

  for (const section of group.sections) {
    const sectionTokens = estimateTokenCount(section.content);

    // Tables and code blocks are never split — they get their own chunk
    if (section.type === "table" || section.type === "code") {
      flush(); // Flush any accumulated paragraphs first

      if (sectionTokens > maxTokens) {
        // Oversized table/code — fallback split but try to keep it meaningful
        const fallbackChunks = await fallbackSplit(
          section.content,
          maxTokens,
          overlapTokens,
          section.type,
          group.heading,
          rawContent
        );
        chunks.push(...fallbackChunks);
      } else {
        const startChar = rawContent.indexOf(section.content);
        chunks.push({
          content: section.content,
          chunkIndex: 0,
          chunkType: section.type,
          sectionTitle: group.heading,
          metadata: {
            startChar: startChar >= 0 ? startChar : 0,
            endChar: startChar >= 0 ? startChar + section.content.length : section.content.length,
            ...(section.language ? { language: section.language } : {}),
          },
        });
      }
      continue;
    }

    // Lists: keep together if under target, split at item boundaries if over
    if (section.type === "list") {
      flush();

      if (sectionTokens <= targetTokens) {
        const startChar = rawContent.indexOf(section.content);
        chunks.push({
          content: section.content,
          chunkIndex: 0,
          chunkType: "list",
          sectionTitle: group.heading,
          metadata: {
            startChar: startChar >= 0 ? startChar : 0,
            endChar: startChar >= 0 ? startChar + section.content.length : section.content.length,
          },
        });
      } else {
        // Split at list item boundaries
        const listChunks = splitListByItems(section.content, targetTokens, group.heading, rawContent);
        chunks.push(...listChunks);
      }
      continue;
    }

    // Paragraphs and frontmatter: merge until target token count
    const combinedTokens = estimateTokenCount(accumulatedContent + "\n\n" + section.content);

    if (accumulatedContent && combinedTokens > targetTokens) {
      flush();
      accumulatedContent = section.content;
      accumulatedType = section.type;
    } else {
      if (accumulatedContent) {
        accumulatedContent += "\n\n" + section.content;
      } else {
        accumulatedContent = section.content;
        accumulatedType = section.type;
      }
    }
  }

  flush();
  return chunks;
}

/**
 * Split a list into chunks at item boundaries.
 */
function splitListByItems(
  listContent: string,
  targetTokens: number,
  sectionTitle: string,
  rawContent: string
): PreEnrichmentChunk[] {
  // Split into individual list items
  const items = listContent.split(/\n(?=[-•*]\s|\d+[.)]\s)/);
  const chunks: PreEnrichmentChunk[] = [];
  let currentItems: string[] = [];

  for (const item of items) {
    const wouldBe = [...currentItems, item].join("\n");
    if (currentItems.length > 0 && estimateTokenCount(wouldBe) > targetTokens) {
      const content = currentItems.join("\n");
      const startChar = rawContent.indexOf(content);
      chunks.push({
        content,
        chunkIndex: 0,
        chunkType: "list",
        sectionTitle,
        metadata: {
          startChar: startChar >= 0 ? startChar : 0,
          endChar: startChar >= 0 ? startChar + content.length : content.length,
        },
      });
      currentItems = [item];
    } else {
      currentItems.push(item);
    }
  }

  if (currentItems.length > 0) {
    const content = currentItems.join("\n");
    const startChar = rawContent.indexOf(content);
    chunks.push({
      content,
      chunkIndex: 0,
      chunkType: "list",
      sectionTitle,
      metadata: {
        startChar: startChar >= 0 ? startChar : 0,
        endChar: startChar >= 0 ? startChar + content.length : content.length,
      },
    });
  }

  return chunks;
}

/**
 * Fallback to RecursiveCharacterTextSplitter for oversized sections.
 */
async function fallbackSplit(
  content: string,
  maxTokens: number,
  overlapTokens: number,
  chunkType: ChunkType,
  sectionTitle: string,
  rawContent: string
): Promise<PreEnrichmentChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: tokensToChars(maxTokens),
    chunkOverlap: tokensToChars(overlapTokens),
    separators: ["\n\n", "\n", ". ", " ", ""],
    keepSeparator: true,
  });

  const splits = await splitter.createDocuments([content]);

  return splits.map((split) => {
    const text = split.pageContent;
    const startChar = rawContent.indexOf(text);
    return {
      content: text,
      chunkIndex: 0,
      chunkType,
      sectionTitle,
      metadata: {
        startChar: startChar >= 0 ? startChar : 0,
        endChar: startChar >= 0 ? startChar + text.length : text.length,
      },
    };
  });
}
