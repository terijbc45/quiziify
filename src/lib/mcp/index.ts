import { auth, defineMcp } from "@lovable.dev/mcp-js";
import {
  getProfileTool,
  listRemindersTool,
  createReminderTool,
  listMyPostsTool,
  recentQuizAttemptsTool,
} from "./tools";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "quiziify-mcp",
  title: "Quiziify",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Quiziify user. Use `get_profile` for their class and optional subjects, `list_reminders` / `create_reminder` for study reminders, `list_my_posts` for their published quizzes, and `list_quiz_attempts` for recent quiz history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, listRemindersTool, createReminderTool, listMyPostsTool, recentQuizAttemptsTool],
});
