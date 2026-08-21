import { createFileRoute } from "@tanstack/react-router";

const FIRECRAWL = "https://api.firecrawl.dev/v2";

export const Route = createFileRoute("/api/public/cdc-debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = process.env["FIRECRAWL_API_KEY"];
        if (!key) return Response.json({ error: "no key" }, { status: 500 });
        const mode = url.searchParams.get("mode") ?? "search";
        if (mode === "cdc") {
          const { fetchCdcTextbookSource } = await import("@/server/cdc.server");
          const src = await fetchCdcTextbookSource(url.searchParams.get("grade") ?? "10", url.searchParams.get("subject") ?? "Science");
          return Response.json({ ...src, toc: src.toc.slice(0, 3000) });
        }
        const q = url.searchParams.get("q") ?? "class 10 science textbook";
        if (mode === "map") {
          const r = await fetch(`${FIRECRAWL}/map`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: "https://moecdc.gov.np", search: q, limit: 40 }),
          });
          return Response.json({ status: r.status, body: await r.json() });
        }
        if (mode === "scrape") {
          const r = await fetch(`${FIRECRAWL}/scrape`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: q, formats: ["rawHtml"], onlyMainContent: false }),
          });
          const j: any = await r.json();
          const html: string = j?.rawHtml ?? j?.data?.rawHtml ?? "";
          return Response.json({
            status: r.status,
            len: html.length,
            pdfs: [...new Set([...html.matchAll(/https?:\/\/[^"'\s<>()]+\.pdf/gi)].map((m) => m[0]))].slice(0, 20),
          });
        }
        const r = await fetch(`${FIRECRAWL}/search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, limit: 10 }),
        });
        return Response.json({ status: r.status, body: await r.json() });
      },
    },
  },
});
