import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function client(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getProfileTool = defineTool({
  name: "get_profile",
  title: "Get my Quiziify profile",
  description: "Returns the signed-in user's Quiziify profile (display name, class, country, bio, optional subjects).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await client(ctx.getToken()!)
      .from("profiles")
      .select("display_name,country,grade,bio,optional_subjects")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? {}) }], structuredContent: { profile: data } };
  },
});

export const listRemindersTool = defineTool({
  name: "list_reminders",
  title: "List my reminders",
  description: "Lists the signed-in user's Quiziify reminders (title, body, fire time, fired state), most recent first.",
  inputSchema: { limit: z.number().int().min(1).max(100).optional().describe("Max reminders to return (default 20).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await client(ctx.getToken()!)
      .from("reminders")
      .select("id,title,body,fire_at,fired,created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("fire_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { reminders: data ?? [] } };
  },
});

export const createReminderTool = defineTool({
  name: "create_reminder",
  title: "Create a reminder",
  description: "Creates a new Quiziify reminder for the signed-in user. fire_at must be an ISO-8601 timestamp.",
  inputSchema: {
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(600).optional(),
    fire_at: z.string().describe("ISO-8601 timestamp for when the reminder should fire."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, body, fire_at }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const when = new Date(fire_at);
    if (isNaN(when.getTime())) return { content: [{ type: "text", text: "Invalid fire_at" }], isError: true };
    const { data, error } = await client(ctx.getToken()!)
      .from("reminders")
      .insert({ user_id: ctx.getUserId()!, title, body: body ?? null, fire_at: when.toISOString() })
      .select("id,title,body,fire_at,fired")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { reminder: data } };
  },
});

export const listMyPostsTool = defineTool({
  name: "list_my_posts",
  title: "List my posts",
  description: "Lists the signed-in user's published quiz posts (question, topic, difficulty), most recent first.",
  inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await client(ctx.getToken()!)
      .from("user_quizzes")
      .select("id,question,topic,difficulty,created_at")
      .eq("author_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { posts: data ?? [] } };
  },
});

export const recentQuizAttemptsTool = defineTool({
  name: "list_quiz_attempts",
  title: "List my recent quiz attempts",
  description: "Lists the signed-in user's recent Quiziify quiz attempts with score and mode.",
  inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await client(ctx.getToken()!)
      .from("quiz_attempts")
      .select("id,mode,topic,difficulty,level,score,total,created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { attempts: data ?? [] } };
  },
});
