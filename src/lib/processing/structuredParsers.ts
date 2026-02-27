import { extractText } from "unpdf";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { StructuredDocument, StructuredSection, ChunkType } from "./types";

/**
 * Parse a Markdown file into structured sections using the remark AST.
 * This is the most accurate parser since Markdown has explicit structure.
 */
export async function parseMarkdownStructured(content: string): Promise<StructuredDocument> {
  const { data: frontmatter, content: markdownBody } = matter(content);

  const tree = await remark().use(remarkGfm).parse(markdownBody);

  const sections: StructuredSection[] = [];
  let position = 0;
  let currentHeading: string | undefined;

  for (const node of tree.children) {
    const section = astNodeToSection(node, position, currentHeading);
    if (section) {
      sections.push(section);
      if (section.type === "heading") {
        currentHeading = section.content;
      }
      position++;
    }
  }

  // Add frontmatter as a section if present
  if (Object.keys(frontmatter).length > 0) {
    const frontmatterContent = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    sections.unshift({
      type: "frontmatter",
      content: frontmatterContent,
      position: 0,
    });
    // Shift all positions
    for (let i = 1; i < sections.length; i++) {
      sections[i].position = i;
    }
  }

  return {
    sections,
    metadata: frontmatter,
    rawContent: markdownBody.trim(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function astNodeToSection(node: any, position: number, parentHeading?: string): StructuredSection | null {
  switch (node.type) {
    case "heading": {
      const text = extractTextFromAstNode(node);
      return {
        type: "heading",
        content: text,
        level: node.depth,
        parentHeading,
        position,
      };
    }
    case "paragraph": {
      const text = extractTextFromAstNode(node);
      if (!text.trim()) return null;
      return {
        type: "paragraph",
        content: text,
        parentHeading,
        position,
      };
    }
    case "code": {
      return {
        type: "code",
        content: node.value || "",
        language: node.lang || undefined,
        parentHeading,
        position,
      };
    }
    case "table": {
      const tableText = formatTableNode(node);
      return {
        type: "table",
        content: tableText,
        parentHeading,
        position,
      };
    }
    case "list": {
      const listText = formatListNode(node);
      return {
        type: "list",
        content: listText,
        parentHeading,
        position,
      };
    }
    case "blockquote": {
      const text = extractTextFromAstNode(node);
      return {
        type: "paragraph",
        content: text,
        parentHeading,
        position,
      };
    }
    case "html": {
      if (node.value && node.value.trim()) {
        return {
          type: "paragraph",
          content: node.value,
          parentHeading,
          position,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromAstNode(node: any): string {
  if (typeof node.value === "string") return node.value;
  if (node.children) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node.children.map((child: any) => extractTextFromAstNode(child)).join("");
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTableNode(node: any): string {
  if (!node.children) return "";

  const rows: string[][] = [];
  for (const row of node.children) {
    if (row.children) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cells = row.children.map((cell: any) => extractTextFromAstNode(cell).trim());
      rows.push(cells);
    }
  }

  if (rows.length === 0) return "";

  // Format as readable table
  const lines: string[] = [];
  const header = rows[0];
  lines.push("| " + header.join(" | ") + " |");
  lines.push("| " + header.map(() => "---").join(" | ") + " |");
  for (let i = 1; i < rows.length; i++) {
    lines.push("| " + rows[i].join(" | ") + " |");
  }

  return lines.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatListNode(node: any, depth: number = 0): string {
  if (!node.children) return "";

  const indent = "  ".repeat(depth);
  const ordered = node.ordered === true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return node.children.map((item: any, index: number) => {
    const bullet = ordered ? `${index + 1}.` : "-";
    const parts: string[] = [];

    if (item.children) {
      for (const child of item.children) {
        if (child.type === "list") {
          parts.push(formatListNode(child, depth + 1));
        } else {
          parts.push(extractTextFromAstNode(child));
        }
      }
    }

    const firstLine = parts[0] || "";
    const rest = parts.slice(1).join("\n");
    return `${indent}${bullet} ${firstLine}${rest ? "\n" + rest : ""}`;
  }).join("\n");
}

/**
 * Parse a PDF file into structured sections using heuristics.
 * PDF lacks semantic structure, so we use heuristic detection for
 * headings, lists, tables, and code blocks.
 */
export async function parsePDFStructured(buffer: Buffer): Promise<StructuredDocument> {
  const uint8Array = new Uint8Array(buffer);

  const { text, totalPages } = await extractText(uint8Array, {
    mergePages: false,
  });

  const pages = Array.isArray(text) ? text : [text];
  const fullText = pages.join("\n\n");

  // Split into lines and analyze structure
  const lines = fullText.split("\n");
  const sections: StructuredSection[] = [];
  let position = 0;
  let currentHeading: string | undefined;
  let accumulatedParagraph: string[] = [];

  const flushParagraph = () => {
    const content = accumulatedParagraph.join("\n").trim();
    if (content) {
      sections.push({
        type: "paragraph",
        content,
        parentHeading: currentHeading,
        position: position++,
      });
    }
    accumulatedParagraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line — potential paragraph break
      if (accumulatedParagraph.length > 0) {
        flushParagraph();
      }
      continue;
    }

    const lineType = classifyPDFLine(trimmed, lines[i + 1]?.trim());

    if (lineType === "heading") {
      flushParagraph();
      currentHeading = trimmed;
      sections.push({
        type: "heading",
        content: trimmed,
        level: estimateHeadingLevel(trimmed),
        parentHeading: undefined,
        position: position++,
      });
    } else if (lineType === "list-item") {
      flushParagraph();
      // Collect consecutive list items
      const listItems: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) break;
        if (classifyPDFLine(nextTrimmed) === "list-item") {
          listItems.push(nextTrimmed);
          j++;
        } else {
          break;
        }
      }
      sections.push({
        type: "list",
        content: listItems.join("\n"),
        parentHeading: currentHeading,
        position: position++,
      });
      i = j - 1; // Skip consumed lines
    } else {
      accumulatedParagraph.push(trimmed);
    }
  }

  flushParagraph();

  return {
    sections,
    metadata: { pageCount: totalPages },
    rawContent: fullText.trim(),
  };
}

function classifyPDFLine(line: string, nextLine?: string): "heading" | "list-item" | "paragraph" {
  // List item detection
  if (/^[-•*]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
    return "list-item";
  }

  // Heading heuristics:
  // 1. Short ALL CAPS lines (likely section headers)
  if (line.length <= 80 && line === line.toUpperCase() && /[A-Z]/.test(line) && !/[.!?]$/.test(line)) {
    return "heading";
  }

  // 2. Short line followed by longer text (likely heading + paragraph)
  if (line.length <= 60 && !line.endsWith(".") && !line.endsWith(",") && nextLine && nextLine.length > line.length) {
    // Only if it looks like a title (starts with capital, no trailing punctuation)
    if (/^[A-Z]/.test(line) && !/[,;:]$/.test(line)) {
      return "heading";
    }
  }

  return "paragraph";
}

function estimateHeadingLevel(text: string): number {
  if (text === text.toUpperCase()) return 1;
  if (text.length <= 30) return 2;
  return 3;
}

/**
 * Parse a plain text file into structured sections.
 * Uses pattern detection for Markdown-like syntax in .txt files.
 */
export async function parseTextStructured(content: string): Promise<StructuredDocument> {
  const lines = content.split("\n");
  const sections: StructuredSection[] = [];
  let position = 0;
  let currentHeading: string | undefined;
  let accumulatedParagraph: string[] = [];

  const flushParagraph = () => {
    const text = accumulatedParagraph.join("\n").trim();
    if (text) {
      sections.push({
        type: "paragraph",
        content: text,
        parentHeading: currentHeading,
        position: position++,
      });
    }
    accumulatedParagraph = [];
  };

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Fenced code block detection
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        flushParagraph();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim() || undefined;
        codeBlockContent = [];
      } else {
        sections.push({
          type: "code",
          content: codeBlockContent.join("\n"),
          language: codeBlockLang,
          parentHeading: currentHeading,
          position: position++,
        });
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = undefined;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Markdown heading detection
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flushParagraph();
      const headingContent = headingMatch[2];
      currentHeading = headingContent;
      sections.push({
        type: "heading",
        content: headingContent,
        level: headingMatch[1].length,
        parentHeading: undefined,
        position: position++,
      });
      continue;
    }

    // Empty line — paragraph break
    if (!trimmed) {
      if (accumulatedParagraph.length > 0) {
        flushParagraph();
      }
      continue;
    }

    // List item detection
    if (/^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      flushParagraph();
      const listItems: string[] = [trimmed];
      // We'll collect just this one; the loop naturally continues
      sections.push({
        type: "list",
        content: trimmed,
        parentHeading: currentHeading,
        position: position++,
      });
      continue;
    }

    accumulatedParagraph.push(trimmed);
  }

  // Flush remaining
  if (inCodeBlock && codeBlockContent.length > 0) {
    sections.push({
      type: "code",
      content: codeBlockContent.join("\n"),
      language: codeBlockLang,
      parentHeading: currentHeading,
      position: position++,
    });
  }
  flushParagraph();

  return {
    sections,
    metadata: {},
    rawContent: content.trim(),
  };
}

/**
 * Parse a document into structured sections based on file type.
 * Falls back to the V1 flat-text approach if structured parsing fails.
 */
export async function parseDocumentStructured(
  buffer: Buffer,
  fileType: string
): Promise<StructuredDocument> {
  switch (fileType) {
    case "pdf":
      return parsePDFStructured(buffer);
    case "md":
      return parseMarkdownStructured(buffer.toString("utf-8"));
    case "txt":
      return parseTextStructured(buffer.toString("utf-8"));
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
