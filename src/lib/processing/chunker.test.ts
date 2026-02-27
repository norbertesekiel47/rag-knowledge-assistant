import { describe, it, expect } from "vitest";
import { chunkDocument, getChunkingConfig } from "./chunker";

describe("chunkDocument", () => {
  it("returns empty array for empty string", async () => {
    const result = await chunkDocument("");
    expect(result).toEqual([]);
  });

  it("returns empty array for whitespace-only", async () => {
    const result = await chunkDocument("   \n\t  ");
    expect(result).toEqual([]);
  });

  it("returns single chunk for short content", async () => {
    const result = await chunkDocument("Hello, this is a short document.");
    expect(result).toHaveLength(1);
    expect(result[0].chunkIndex).toBe(0);
    expect(result[0].content).toContain("Hello");
  });

  it("splits long content into multiple chunks", async () => {
    // Create content longer than chunk size (1000 chars)
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `Paragraph ${i + 1}. ${"This is a sentence that adds to the overall length of the document. ".repeat(3)}`
    ).join("\n\n");

    const result = await chunkDocument(paragraphs);
    expect(result.length).toBeGreaterThan(1);
  });

  it("assigns sequential chunk indices", async () => {
    const content = "A ".repeat(1500);
    const result = await chunkDocument(content);
    result.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });

  it("includes metadata with start and end chars", async () => {
    const result = await chunkDocument("Short document content.");
    expect(result[0].metadata).toHaveProperty("startChar");
    expect(result[0].metadata).toHaveProperty("endChar");
    expect(typeof result[0].metadata.startChar).toBe("number");
    expect(typeof result[0].metadata.endChar).toBe("number");
  });

  it("preserves document metadata", async () => {
    const result = await chunkDocument("Some content.", { source: "test.pdf" });
    expect(result[0].metadata.source).toBe("test.pdf");
  });
});

describe("getChunkingConfig", () => {
  it("returns correct chunk size", () => {
    expect(getChunkingConfig().chunkSize).toBe(1000);
  });

  it("returns correct chunk overlap", () => {
    expect(getChunkingConfig().chunkOverlap).toBe(200);
  });
});
