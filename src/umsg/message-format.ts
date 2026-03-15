import { join } from "path";
import { readFileSync } from "fs";

const FORMAT_FILE = join(import.meta.dir, "..", "..", "data", "prompts", "format.md");
export const FORMAT_INSTRUCTIONS = readFileSync(FORMAT_FILE, "utf-8").trim();

export function formatIncoming(summary: string | undefined, content: string): string {
  const summaryLine = summary || content.slice(0, 100);
  return `# Summary\n${summaryLine}\n\n# Content\n${content}`;
}

export function parseResponse(text: string): { summary: string; content: string; handoff?: string } {
  // Extract # Handoff (always last if present)
  let remaining = text;
  let handoff: string | undefined;
  const handoffIdx = remaining.indexOf("# Handoff");
  if (handoffIdx !== -1) {
    const handoffRaw = remaining.slice(handoffIdx + "# Handoff".length).trim().split(/[\s\n]/)[0].toLowerCase();
    handoff = handoffRaw || undefined;
    remaining = remaining.slice(0, handoffIdx).trim();
  }

  const contentIdx = remaining.indexOf("# Content");
  const summaryIdx = remaining.indexOf("# Summary");

  // Content first, Summary after
  if (contentIdx !== -1 && summaryIdx !== -1 && summaryIdx > contentIdx) {
    const contentPart = remaining.slice(contentIdx + "# Content".length, summaryIdx).trim();
    const summaryPart = remaining.slice(summaryIdx + "# Summary".length).trim();
    return { summary: summaryPart.slice(0, 200), content: contentPart, handoff };
  }

  // Summary first, Content after
  if (summaryIdx !== -1 && contentIdx !== -1 && contentIdx > summaryIdx) {
    const summaryPart = remaining.slice(summaryIdx + "# Summary".length, contentIdx).trim();
    const contentPart = remaining.slice(contentIdx + "# Content".length).trim();
    return { summary: summaryPart.slice(0, 200), content: contentPart, handoff };
  }

  // No # Content but # Summary exists → everything before Summary is content
  if (summaryIdx !== -1) {
    const contentPart = remaining.slice(0, summaryIdx).trim();
    const summaryPart = remaining.slice(summaryIdx + "# Summary".length).trim();
    return { summary: summaryPart.slice(0, 200), content: contentPart || remaining, handoff };
  }

  // No markers: fallback
  return { summary: remaining.slice(0, 50), content: remaining, handoff };
}
