// Server-only helpers for NotebookLM-style study tools (flashcards + podcast),
// grounded in the verified textbook extract stored in `curriculum_cache`.
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function admin() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const { data } = await admin()
      .from("curriculum_cache")
      .select("payload,fetched_at")
      .eq("key", key)
      .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > 1000 * 60 * 60 * 24 * 30) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, payload: unknown) {
  try {
    await admin()
      .from("curriculum_cache")
      .upsert({ key, payload, fetched_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {
    /* cache is best-effort */
  }
}

/** Verified book extract for a grade + subject, if we already scraped it. */
export async function bookExtract(grade: string, subject: string): Promise<{
  toc: string;
  pageUrl: string | null;
  pdfUrl: string | null;
  publisher?: string | null;
} | null> {
  const src = await cacheGet<{
    toc?: string;
    pageUrl?: string | null;
    pdfUrl?: string | null;
    publisher?: string | null;
    verified?: boolean;
  }>(`cdc-book:v3:${grade.toLowerCase()}:${subject.toLowerCase()}`);
  if (!src?.toc) return null;
  return {
    toc: src.toc,
    pageUrl: src.pageUrl ?? null,
    pdfUrl: src.pdfUrl ?? null,
    publisher: src.publisher ?? null,
  };
}

export async function aiTool<T>(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  toolName: string,
  schema: Record<string, unknown>,
): Promise<T | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app yet.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: { name: toolName, parameters: schema } }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The study tools are busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits for this app have run out. Please top them up to keep studying.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(body.slice(0, 200) || `AI request failed (${res.status}).`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? (JSON.parse(args) as T) : null;
}
