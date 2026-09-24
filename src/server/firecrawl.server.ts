// Fresh news snippets for quiz generators — uses free Google News RSS.
import { newsHeadlines } from "./free-web.server";

const QUERY_POOL = [
  "world news", "science discovery", "sports", "technology", "entertainment", "space exploration", "Nepal",
];

export async function fetchLatestSnippets(topicHint?: string): Promise<string> {
  try {
    const q = topicHint && topicHint !== "any" ? topicHint : QUERY_POOL[Math.floor(Math.random() * QUERY_POOL.length)]!;
    const items = await newsHeadlines(q, 6);
    return items.map((t) => `- ${t}`).join("\n");
  } catch {
    return "";
  }
}
