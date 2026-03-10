import { describe, test, expect } from "bun:test";
import { formatIncoming, parseResponse, FORMAT_INSTRUCTIONS } from "../message-format";

describe("formatIncoming", () => {
  test("formats with both summary and content", () => {
    const result = formatIncoming("User needs help", "Please explain TypeScript generics.");
    expect(result).toBe("# Summary\nUser needs help\n\n# Content\nPlease explain TypeScript generics.");
  });

  test("fallback: uses first 100 chars of content when summary is undefined", () => {
    const content = "This is the message content";
    const result = formatIncoming(undefined, content);
    expect(result).toBe(`# Summary\n${content}\n\n# Content\n${content}`);
  });

  test("fallback: uses first 100 chars of content when summary is empty string", () => {
    const content = "Hello world";
    const result = formatIncoming("", content);
    expect(result).toBe(`# Summary\nHello world\n\n# Content\nHello world`);
  });

  test("fallback: truncates long content to 100 chars for summary", () => {
    const content = "A".repeat(200);
    const result = formatIncoming(undefined, content);
    expect(result.startsWith("# Summary\n" + "A".repeat(100))).toBe(true);
  });

  test("uses provided summary, not content, when summary is set", () => {
    const result = formatIncoming("Brief summary", "Long detailed content here");
    expect(result).toContain("# Summary\nBrief summary");
    expect(result).toContain("# Content\nLong detailed content here");
  });
});

describe("parseResponse", () => {
  test("parses well-formed response with both headers", () => {
    const text = "# Summary\nThis is the summary line\n\n# Content\nThis is the full content.";
    const result = parseResponse(text);
    expect(result.summary).toBe("This is the summary line");
    expect(result.content).toBe("This is the full content.");
  });

  test("fallback: no headers → summary=first 200 chars, content=full text", () => {
    const text = "Just some plain response without headers.";
    const result = parseResponse(text);
    expect(result.summary).toBe(text.slice(0, 200));
    expect(result.content).toBe(text);
  });

  test("fallback: missing # Content header", () => {
    const text = "# Summary\nSome summary but no content header";
    const result = parseResponse(text);
    expect(result.summary).toBe(text.slice(0, 200));
    expect(result.content).toBe(text);
  });

  test("fallback: missing # Summary header", () => {
    const text = "# Content\nSome content without summary header";
    const result = parseResponse(text);
    expect(result.summary).toBe(text.slice(0, 200));
    expect(result.content).toBe(text);
  });

  test("summary truncated to 200 chars", () => {
    const longSummary = "S".repeat(300);
    const text = `# Summary\n${longSummary}\n\n# Content\nContent here.`;
    const result = parseResponse(text);
    expect(result.summary.length).toBeLessThanOrEqual(200);
    expect(result.content).toBe("Content here.");
  });

  test("content includes everything after # Content header", () => {
    const text = "# Summary\nQuick summary\n\n# Content\nLine 1\nLine 2\nLine 3";
    const result = parseResponse(text);
    expect(result.content).toBe("Line 1\nLine 2\nLine 3");
  });
});

describe("FORMAT_INSTRUCTIONS", () => {
  test("contains required headers", () => {
    expect(FORMAT_INSTRUCTIONS).toContain("# Summary");
    expect(FORMAT_INSTRUCTIONS).toContain("# Content");
  });

  test("mentions 200 characters limit", () => {
    expect(FORMAT_INSTRUCTIONS).toContain("200");
  });

  test("mentions markdown and English", () => {
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("markdown");
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("english");
  });
});
