import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin, claimFirstAdmin, listUnverified, verifyItem, syncSubject } from "@/lib/cdc-admin.functions";
import { listClasses, listSubjects } from "@/lib/cdc-learning.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/cdc")({
  component: () => (<AppShell><AdminCDC /></AppShell>),
});

function AdminCDC() {
  const check = useServerFn(checkIsAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const [state, setState] = useState<"loading" | "notAdmin" | "noAdmins" | "ok">("loading");

  useEffect(() => {
    check().then((r) => setState(r.isAdmin ? "ok" : r.adminCount === 0 ? "noAdmins" : "notAdmin")).catch(() => setState("notAdmin"));
  }, [check]);

  if (state === "loading") return <div className="text-muted-foreground">Loading…</div>;
  if (state === "notAdmin") return (
    <div className="max-w-lg mx-auto text-center py-16 space-y-3">
      <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-bold">Admin access required</h1>
      <p className="text-muted-foreground text-sm">This dashboard is for CDC curriculum reviewers.</p>
      <Link to="/" className="text-primary underline text-sm">Back home</Link>
    </div>
  );
  if (state === "noAdmins") return (
    <div className="max-w-lg mx-auto text-center py-16 space-y-4">
      <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
      <h1 className="text-xl font-bold">No admin set yet</h1>
      <p className="text-muted-foreground text-sm">Claim admin access to review curriculum content.</p>
      <Button onClick={async () => {
        const r = await claim();
        if (r.claimed) { toast.success("You're now the admin"); setState("ok"); }
        else toast.error("Could not claim (an admin already exists)");
      }}>Claim admin</Button>
    </div>
  );

  return <Dashboard />;
}

function Dashboard() {
  const [tab, setTab] = useState<"sync" | "queue" | "log">("sync");
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /> CDC Admin</h1>
        <p className="text-muted-foreground text-sm">Sync curriculum from CDC/NEB sources and review it before students see it.</p>
      </div>
      <div className="flex gap-2 border-b">
        {(["sync", "queue", "log"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            {t === "sync" ? "Sync curriculum" : t === "queue" ? "Review queue" : "Sync log"}
          </button>
        ))}
      </div>
      {tab === "sync" && <SyncTab />}
      {tab === "queue" && <QueueTab />}
      {tab === "log" && <LogTab />}
    </div>
  );
}

function SyncTab() {
  const listCls = useServerFn(listClasses);
  const listSubs = useServerFn(listSubjects);
  const sync = useServerFn(syncSubject);
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { listCls().then((r) => setClasses(r.classes)); }, [listCls]);
  useEffect(() => { if (classId) listSubs({ data: { id: classId } }).then((r) => setSubjects(r.subjects)); }, [classId, listSubs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c.id} onClick={() => setClassId(c.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${classId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
            Class {c.grade}{c.stream ? ` · ${c.stream}` : ""}
          </button>
        ))}
      </div>
      {classId && (
        <div className="grid sm:grid-cols-2 gap-3">
          {subjects.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.subject_name}</div>
                <div className="text-xs text-muted-foreground">{s.is_compulsory ? "Compulsory" : s.is_optional ? "Optional" : ""}</div>
              </div>
              <Button size="sm" disabled={busy === s.id} onClick={async () => {
                setBusy(s.id);
                try {
                  const r = await sync({ data: { subject_id: s.id } });
                  toast.success(`Sync ok: +${r.chunksAdded} chunks, +${r.questionsAdded} questions`);
                } catch (e: any) { toast.error(e?.message ?? "Sync failed"); }
                finally { setBusy(null); }
              }}>
                {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1">Sync</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueTab() {
  const load = useServerFn(listUnverified);
  const verify = useServerFn(verifyItem);
  const [data, setData] = useState<{ chunks: any[]; questions: any[] } | null>(null);
  const refresh = () => load().then((r) => setData({ chunks: r.chunks, questions: r.questions }));
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const act = async (id: string, kind: "chunk" | "question", approve: boolean) => {
    try { await verify({ data: { id, kind, approve } }); toast.success(approve ? "Approved" : "Rejected"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  if (!data) return <div className="text-muted-foreground text-sm">Loading queue…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-bold mb-2">Content chunks ({data.chunks.length})</h2>
        <div className="space-y-2">
          {data.chunks.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm whitespace-pre-wrap">{c.raw_text}</p>
              {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-2 inline-block">source</a>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => act(c.id, "chunk", true)}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => act(c.id, "chunk", false)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
              </div>
            </div>
          ))}
          {data.chunks.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review 🎉</p>}
        </div>
      </section>
      <section>
        <h2 className="font-bold mb-2">Questions ({data.questions.length})</h2>
        <div className="space-y-2">
          {data.questions.map((q) => (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-medium text-sm">{q.question_text}</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {(q.options ?? []).map((o: string, i: number) => (
                  <li key={i} className={o === q.correct_answer ? "text-emerald-600 font-semibold" : ""}>• {o}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => act(q.id, "question", true)}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => act(q.id, "question", false)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
              </div>
            </div>
          ))}
          {data.questions.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review 🎉</p>}
        </div>
      </section>
    </div>
  );
}

function LogTab() {
  const load = useServerFn(listUnverified);
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { load().then((r) => setLogs(r.logs)); }, [load]);
  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="rounded-xl border border-border bg-card p-3 text-sm flex items-center justify-between">
          <div>
            <div className="font-medium">{l.scope}</div>
            <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()} · +{l.chunks_added} chunks · +{l.questions_added} Qs</div>
            {l.error_text && <div className="text-xs text-destructive mt-1">{l.error_text}</div>}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === "ok" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>{l.status}</span>
        </div>
      ))}
      {logs.length === 0 && <p className="text-sm text-muted-foreground">No sync runs yet.</p>}
    </div>
  );
}
