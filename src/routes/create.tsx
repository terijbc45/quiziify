import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create")({ component: () => <AppShell><Create /></AppShell> });

const schema = z.object({
  topic: z.string().trim().min(1).max(60),
  question: z.string().trim().min(5).max(500),
  options: z.array(z.string().trim().min(1).max(200)).length(4),
  correct_index: z.number().min(0).max(3),
  explanation: z.string().trim().max(500).optional(),
  difficulty: z.enum(["easy", "intermediate", "hard"]),
});

function Create() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [diff, setDiff] = useState<"easy" | "intermediate" | "hard">("intermediate");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ topic, question, options, correct_index: correct, explanation, difficulty: diff });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("user_quizzes").insert({
      author_id: user.id,
      topic: parsed.data.topic,
      difficulty: parsed.data.difficulty,
      question: parsed.data.question,
      options: parsed.data.options,
      correct_index: parsed.data.correct_index,
      explanation: parsed.data.explanation || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question published! It will appear in Random mode.");
    nav({ to: "/" });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav({ to: "/" })} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Home
      </Button>

      <div className="rounded-3xl bg-card p-7 shadow-card border border-border animate-slide-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-hero flex items-center justify-center text-white shadow-soft">
            <Plus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create a question</h1>
            <p className="text-sm text-muted-foreground">It'll show in Random with your name on it.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="History" maxLength={60} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div className="grid grid-cols-3 gap-1">
                {(["easy", "intermediate", "hard"] as const).map((d) => (
                  <button key={d} onClick={() => setDiff(d)} className={`h-11 rounded-xl text-xs font-semibold capitalize border-2 ${diff === d ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{d[0].toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What is…" maxLength={500} className="rounded-xl min-h-20" />
          </div>

          <div className="space-y-2">
            <Label>Options (tap to mark correct)</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <button
                  onClick={() => setCorrect(i)}
                  className={`h-11 w-11 shrink-0 rounded-xl font-bold text-sm border-2 transition-all ${
                    correct === i ? "border-success bg-success text-success-foreground" : "border-border"
                  }`}
                >{String.fromCharCode(65 + i)}</button>
                <Input
                  value={opt}
                  onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Option ${i + 1}`}
                  maxLength={200}
                  className="h-11 rounded-xl"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Explanation (optional)</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why is the answer correct?" maxLength={500} className="rounded-xl" />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-hero font-semibold">
            {busy ? "Publishing…" : "Publish question"}
          </Button>
        </div>
      </div>
    </div>
  );
}
