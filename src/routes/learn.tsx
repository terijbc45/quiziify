import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listClasses, listSubjects, listChapters, listTopics, getTopicMaterial, recordActivity,
} from "@/lib/cdc-learning.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, BookOpen, CheckCircle2, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/learn")({
  component: () => (<AppShell><Learn /></AppShell>),
});

type Step = "class" | "subject" | "chapter" | "topic" | "study";

function Learn() {
  const [step, setStep] = useState<Step>("class");
  const [classItem, setClassItem] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);
  const [chapter, setChapter] = useState<any>(null);
  const [topic, setTopic] = useState<any>(null);

  return (
    <div className="space-y-4 animate-slide-in max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" /> CDC Learning</h1>
        <p className="text-muted-foreground text-sm">Master the official Nepal CDC / NEB syllabus, chapter by chapter.</p>
      </div>
      <Crumbs
        items={[
          { label: "Class", value: classItem ? `Class ${classItem.grade}${classItem.stream ? ` · ${classItem.stream}` : ""}` : null, onClick: () => setStep("class") },
          { label: "Subject", value: subject?.subject_name ?? null, onClick: () => subject && setStep("subject") },
          { label: "Chapter", value: chapter?.chapter_title ?? null, onClick: () => chapter && setStep("chapter") },
          { label: "Topic", value: topic?.topic_title ?? null, onClick: () => topic && setStep("topic") },
        ]}
      />
      {step === "class" && <ClassStep onPick={(c) => { setClassItem(c); setSubject(null); setChapter(null); setTopic(null); setStep("subject"); }} />}
      {step === "subject" && classItem && <SubjectStep classId={classItem.id} onPick={(s) => { setSubject(s); setChapter(null); setTopic(null); setStep("chapter"); }} />}
      {step === "chapter" && subject && <ChapterStep subjectId={subject.id} onPick={(c) => { setChapter(c); setTopic(null); setStep("topic"); }} />}
      {step === "topic" && chapter && <TopicStep chapterId={chapter.id} onPick={(t) => { setTopic(t); setStep("study"); }} />}
      {step === "study" && subject && chapter && topic &&
        <StudyStep subject={subject} chapter={chapter} topic={topic} onDone={() => setStep("topic")} />}
    </div>
  );
}

function Crumbs({ items }: { items: { label: string; value: string | null; onClick: () => void }[] }) {
  return (
    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
      {items.map((i, idx) => (
        <span key={idx}>
          <button onClick={i.onClick} disabled={!i.value} className={i.value ? "hover:text-primary underline underline-offset-2" : "opacity-50"}>
            {i.value ?? i.label}
          </button>
          {idx < items.length - 1 && <span className="mx-1">›</span>}
        </span>
      ))}
    </div>
  );
}

function ClassStep({ onPick }: { onPick: (c: any) => void }) {
  const load = useServerFn(listClasses);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { load().then((r) => setItems(r.classes)); }, [load]);
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {items.map((c) => (
        <button key={c.id} onClick={() => onPick(c)}
          className="rounded-2xl bg-card border border-border p-5 text-left hover:shadow-glow hover:-translate-y-0.5 transition-all">
          <div className="text-2xl font-bold">Class {c.grade}</div>
          {c.stream && <div className="text-xs text-muted-foreground mt-1">{c.stream}</div>}
        </button>
      ))}
      {items.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No classes yet.</div>}
    </div>
  );
}

function SubjectStep({ classId, onPick }: { classId: string; onPick: (s: any) => void }) {
  const load = useServerFn(listSubjects);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { load({ data: { id: classId } }).then((r) => setItems(r.subjects)); }, [load, classId]);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((s) => (
        <button key={s.id} onClick={() => onPick(s)}
          className="rounded-2xl bg-card border border-border p-4 text-left hover:shadow-glow transition-all">
          <div className="font-semibold">{s.subject_name}</div>
          <div className="text-xs text-muted-foreground mt-1">{s.is_compulsory ? "Compulsory" : "Optional"}</div>
        </button>
      ))}
      {items.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No subjects yet.</div>}
    </div>
  );
}

function ChapterStep({ subjectId, onPick }: { subjectId: string; onPick: (c: any) => void }) {
  const load = useServerFn(listChapters);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { load({ data: { id: subjectId } }).then((r) => setItems(r.chapters)); }, [load, subjectId]);
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <button key={c.id} onClick={() => onPick(c)}
          className="w-full rounded-2xl bg-card border border-border p-4 text-left hover:shadow-glow transition-all flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">{c.chapter_number}</div>
          <div className="flex-1">
            <div className="font-semibold">{c.chapter_title}</div>
          </div>
          <BookOpen className="h-5 w-5 text-muted-foreground" />
        </button>
      ))}
      {items.length === 0 && <div className="text-sm text-muted-foreground">No chapters synced yet. Ask your admin to run a curriculum sync.</div>}
    </div>
  );
}

function TopicStep({ chapterId, onPick }: { chapterId: string; onPick: (t: any) => void }) {
  const load = useServerFn(listTopics);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { load({ data: { id: chapterId } }).then((r) => setItems(r.topics)); }, [load, chapterId]);
  return (
    <div className="space-y-2">
      {items.map((t) => (
        <button key={t.id} onClick={() => onPick(t)}
          className="w-full rounded-2xl bg-card border border-border p-4 text-left hover:shadow-glow transition-all">
          <div className="font-semibold">{t.topic_title}</div>
          {t.learning_objectives?.length > 0 && (
            <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
              {t.learning_objectives.slice(0, 3).map((o: string, i: number) => <li key={i}>{o}</li>)}
            </ul>
          )}
        </button>
      ))}
      {items.length === 0 && <div className="text-sm text-muted-foreground">No topics yet.</div>}
    </div>
  );
}

function StudyStep({ subject, chapter, topic, onDone }: { subject: any; chapter: any; topic: any; onDone: () => void }) {
  const load = useServerFn(getTopicMaterial);
  const record = useServerFn(recordActivity);
  const [material, setMaterial] = useState<{ chunks: any[]; questions: any[] } | null>(null);
  const [phase, setPhase] = useState<"read" | "quiz" | "done">("read");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    load({ data: { id: topic.id } }).then((r) => {
      setMaterial({ chunks: r.chunks, questions: r.questions });
      record({ data: { subject_id: subject.id, chapter_id: chapter.id, topic_id: topic.id, status: "in_progress" } }).catch(() => {});
    });
  }, [topic.id]); // eslint-disable-line

  const accuracy = useMemo(() => {
    if (!material || !submitted) return 0;
    const correct = material.questions.filter((q) => answers[q.id] === q.correct_answer).length;
    return material.questions.length ? Math.round((correct / material.questions.length) * 100) : 0;
  }, [material, answers, submitted]);

  if (!material) return <div className="text-muted-foreground text-sm">Loading study material…</div>;

  if (material.chunks.length === 0 && material.questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
        This topic has no verified content yet. Your admin needs to sync + approve it first.
      </div>
    );
  }

  if (phase === "read") {
    return (
      <div className="space-y-4">
        {material.chunks.map((c) => (
          <div key={c.id} className="rounded-2xl bg-card border border-border p-5">
            <p className="whitespace-pre-wrap leading-relaxed">{c.raw_text}</p>
            {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-3 inline-block">source</a>}
          </div>
        ))}
        <Button className="w-full" onClick={() => setPhase("quiz")} disabled={material.questions.length === 0}>
          Take the quick check ({material.questions.length} Qs)
        </Button>
      </div>
    );
  }

  if (phase === "quiz") {
    return (
      <div className="space-y-4">
        {material.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl bg-card border border-border p-4">
            <p className="font-medium mb-2">{i + 1}. {q.question_text}</p>
            <div className="space-y-1.5">
              {(q.options ?? []).map((o: string) => {
                const picked = answers[q.id] === o;
                const isCorrect = submitted && o === q.correct_answer;
                const isWrong = submitted && picked && o !== q.correct_answer;
                return (
                  <button key={o} disabled={submitted} onClick={() => setAnswers({ ...answers, [q.id]: o })}
                    className={`w-full text-left text-sm px-3 py-2 rounded-xl border transition-colors ${
                      isCorrect ? "border-emerald-500 bg-emerald-500/10" :
                      isWrong ? "border-destructive bg-destructive/10" :
                      picked ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}>
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!submitted ? (
          <Button className="w-full" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < material.questions.length}>
            Submit
          </Button>
        ) : (
          <div className="rounded-2xl bg-gradient-hero text-white p-5 text-center space-y-3">
            <div className="text-4xl font-bold">{accuracy}%</div>
            <p className="text-sm text-white/80">Great work! Topic saved to your progress.</p>
            <Button variant="secondary" onClick={async () => {
              try {
                await record({ data: {
                  subject_id: subject.id, chapter_id: chapter.id, topic_id: topic.id,
                  status: accuracy >= 80 ? "mastered" : "completed", accuracy,
                }});
                toast.success("Progress recorded");
              } catch (e: any) { toast.error(e?.message ?? "Could not save"); }
              onDone();
            }}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Next topic
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Export a small streak card for reuse on home.
export function StreakBadge({ current, longest }: { current: number; longest: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center"><Flame className="h-4 w-4" /></div>
      <div>
        <div className="text-xs text-white/70">Streak</div>
        <div className="text-lg font-bold">{current}🔥 <span className="text-xs font-normal text-white/70">best {longest}</span></div>
      </div>
    </div>
  );
}
