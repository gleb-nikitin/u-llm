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
    expect(result.handoff).toBeUndefined();
  });

  test("parses Content first, Summary after", () => {
    const text = "# Content\nFull content here.\n\n# Summary\nBrief keywords";
    const result = parseResponse(text);
    expect(result.content).toBe("Full content here.");
    expect(result.summary).toBe("Brief keywords");
  });

  test("parses # Handoff section", () => {
    const text = "# Content\nDone implementing.\n\n# Summary\nSpec complete\n\n# Handoff\nAuditor";
    const result = parseResponse(text);
    expect(result.content).toBe("Done implementing.");
    expect(result.summary).toBe("Spec complete");
    expect(result.handoff).toBe("auditor");
  });

  test("handoff is lowercased", () => {
    const text = "# Content\nWork done.\n# Summary\nDone\n# Handoff\nCTO";
    const result = parseResponse(text);
    expect(result.handoff).toBe("cto");
  });

  test("handoff with Summary first format", () => {
    const text = "# Summary\nBrief\n\n# Content\nFull response.\n\n# Handoff\nexec";
    const result = parseResponse(text);
    expect(result.content).toBe("Full response.");
    expect(result.summary).toBe("Brief");
    expect(result.handoff).toBe("exec");
  });

  test("no handoff section → handoff undefined", () => {
    const text = "# Content\nJust content.\n# Summary\nSummary";
    const result = parseResponse(text);
    expect(result.handoff).toBeUndefined();
  });

  test("fallback: no headers → summary=first 50 chars, content=full text, no handoff", () => {
    const text = "Just some plain response without headers.";
    const result = parseResponse(text);
    expect(result.summary).toBe(text.slice(0, 50));
    expect(result.content).toBe(text);
    expect(result.handoff).toBeUndefined();
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

  test("no # Content marker — everything before # Summary is content", () => {
    const text = "Full response here.\nMore details.\n\n# Summary\nkeywords here\n\n# Handoff\ncto";
    const result = parseResponse(text);
    expect(result.content).toBe("Full response here.\nMore details.");
    expect(result.summary).toBe("keywords here");
    expect(result.handoff).toBe("cto");
  });
});

describe("FORMAT_INSTRUCTIONS", () => {
  test("contains core directives", () => {
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("markdown");
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("llm");
  });

  test("mentions backend and frontend principles", () => {
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("backend");
    expect(FORMAT_INSTRUCTIONS.toLowerCase()).toContain("frontend");
  });
});
