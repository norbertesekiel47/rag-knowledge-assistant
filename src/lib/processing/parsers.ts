import { extractText } from "unpdf";
import matter from "gray-matter";
import { remark } from "remark";
import strip from "strip-markdown";

export interface ParsedDocument {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse a PDF file and extract text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer);
    
    const { text, totalPages } = await extractText(uint8Array, {
      mergePages: true,
    });

    const content = Array.isArray(text) ? text.join("\n\n") : text;

    return {
      content: content.trim(),
      metadata: {
        pageCount: totalPages,
      },
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse a Markdown file, extracting frontmatter and converting to plain text
 */
export async function parseMarkdown(content: string): Promise<ParsedDocument> {
  try {
    // Extract frontmatter (YAML at the top of the file)
    const { data: frontmatter, content: markdownBody } = matter(content);

    // Convert Markdown to plain text (removes formatting)
    const processedContent = await remark()
      .use(strip)
      .process(markdownBody);

    return {
      content: String(processedContent).trim(),
      metadata: frontmatter,
    };
  } catch (error) {
    console.error("Markdown parsing error:", error);
    throw new Error(
      `Failed to parse Markdown: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse a plain text file
 */
export async function parseText(content: string): Promise<ParsedDocument> {
  return {
    content: content.trim(),
    metadata: {},
  };
}

/**
 * Parse document based on file type
 */
export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<ParsedDocument> {
  switch (fileType) {
    case "pdf":
      return parsePDF(buffer);

    case "md":
      return parseMarkdown(buffer.toString("utf-8"));

    case "txt":
      return parseText(buffer.toString("utf-8"));

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}