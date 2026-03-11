import { join } from "path";
import { readFileSync } from "fs";

const FORMAT_FILE = join(import.meta.dir, "..", "..", "data", "prompts", "format.md");
export const FORMAT_INSTRUCTIONS = readFileSync(FORMAT_FILE, "utf-8").trim();

export function formatIncoming(summary: string | undefined, content: string): string {
  const summaryLine = summary || content.slice(0, 100);
  return `# Summary\n${summaryLine}\n\n# Content\n${content}`;
}

export function parseResponse(text: string): { summary: string; content: string } {
  const summaryIdx = text.indexOf("# Summary");
  const contentIdx = text.indexOf("# Content");

  if (summaryIdx === -1 || contentIdx === -1 || contentIdx <= summaryIdx) {
    return { summary: text.slice(0, 200), content: text };
  }

  const betweenPart = text.slice(summaryIdx + "# Summary".length, contentIdx).trim();
  const contentPart = text.slice(contentIdx + "# Content".length).trim();

  return {
    summary: betweenPart.slice(0, 200),
    content: contentPart,
  };
}
