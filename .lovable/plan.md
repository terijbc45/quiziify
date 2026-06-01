# Quiziify — Curriculum-Driven Study App Overhaul

This is a large, cross-cutting change (branding, auth schema, two new mode flows, image-fetching, animation pass). I'll ship it in 4 ordered phases so each piece is verifiable. Phases 2–4 each require a DB migration; you'll be asked to approve them when I run them.

## Phase 1 — Branding + small polish
- Rename app to **Quiziify** everywhere:
  - `index.html` `<title>` + meta description
  - `public/manifest.webmanifest` name/short_name
  - Any visible "Quiz" / app-name strings in `AppShell`, root layout, auth screens
- Replace the "preparing" loader emoji (🎲 / 🧠) with a **single shared `BrainLoader`** component (animated SVG brain with pulsing synapses) used in `QuizPlayer`, `RamailoPlayer`, and the new Chapters player. No more dice.
- Ramailo → **Random** category prompt rewritten so it covers the full breadth of GK (science, history, geography, sports, arts, literature, current affairs, tech, math puzzles, mythology, etc.) with explicit topic rotation per question.

## Phase 2 — Profile: country + class
Migration:
- Add `country` (text) and `grade` (text, e.g. `nursery`, `kg`, `class_1` … `class_12`) to `profiles`.
- Backfill nullable; no RLS changes.

Code:
- `auth.tsx` signup form: add Country select (searchable, ISO list) + Class select (Nursery, LKG, UKG, Class 1–12). Required on signup; written to `profiles` via existing insert/trigger.
- `profile.tsx`: show country (with flag) and class chip; allow inline edit.
- Small shared `useProfile()` hook so Random/Chapters can read `{ country, grade }`.

## Phase 3 — Firecrawl-backed images (Logo + Places) + curriculum fetcher
A new server module `src/server/firecrawl-images.server.ts`:
- `fetchLogoImage(brand)` — Firecrawl `search` for `"<brand> official logo png"`, return the first usable image URL (filters by extension / domain). Falls back to Clearbit only if Firecrawl returns nothing.
- `fetchPlaceImage(subject, kind)` — Firecrawl `search` for `"<subject> <kind> image"` (monument/landmark/city) → first image URL. For flags keep FlagCDN (already reliable & free).
- Server-side **in-memory + DB cache table** `media_cache(key text pk, url text, fetched_at timestamptz)` so we don't re-hit Firecrawl for the same brand/place. Migration adds the table.

`ramailo.functions.ts` Logo + Places generation calls these helpers and only returns questions where an image actually resolved (re-roll otherwise). `RamailoPlayer` already renders `image_url` — the bug in your screenshot is just that Clearbit was failing for some brands; Firecrawl fallback fixes it.

A second server module `src/server/curriculum.server.ts`:
- `fetchSubjects({ country, grade })` — Firecrawl `search` for `"<country> <grade> school subjects curriculum"`, then `scrape` the top result, then ask Lovable AI to extract a clean JSON list of subjects (with emoji + short blurb). Cached in new `curriculum_cache` table keyed by `(country, grade)`.
- `fetchChapters({ country, grade, subject })` — same pattern, returns ordered chapter list. Cached per `(country, grade, subject)`.

## Phase 4 — Random (curriculum) + Chapters mode
**Random mode rewrite (`src/routes/random.tsx`)**:
- Reads `{ country, grade }` from profile (prompts user to set them if missing).
- Calls `fetchSubjects(...)` → renders a **subject grid** (colored cards, emoji, animate-in).
- On subject click → generates a 5-question quiz scoped to "latest <country> <grade> <subject> curriculum" (passes scraped curriculum snippet into the existing `generateQuestions` prompt as grounding context). Existing prefetch/next-round caching stays.

**Level → Chapters mode**:
- Rename route `/level` → `/chapters` (keep `/level` as a redirect to avoid broken links). Update `play.tsx` card: "Chapters — learn your syllabus, chapter by chapter."
- New flow: Subjects grid → Chapters grid (with progress dots per chapter) → Chapter quiz (10 Qs, curriculum-grounded). On finish: **Restart chapter** + **Next chapter** buttons.
- Progress table migration: `chapter_progress(user_id, country, grade, subject, chapter, completed_at, best_score)`. RLS: user can only read/write their own rows.
- "Reset progress" button on Chapters home wipes the user's `chapter_progress` rows (with confirm dialog) so they can start fresh anytime.

## Technical notes
- All Firecrawl calls go through a new server-only helper that checks `FIRECRAWL_API_KEY` (already connected) and returns `null` on failure — every call site degrades gracefully.
- Curriculum prompts pass the scraped snippet as system context: *"Use ONLY the following official curriculum outline as ground truth: …"* — so questions actually match the syllabus instead of being generic.
- Existing alternating-model prefetch (`PRIMARY_MODEL` / `SECONDARY_MODEL`) is reused for instant next-round in both Random and Chapters.
- No design-token changes; reuse current gradients. New `BrainLoader` is a small self-contained SVG component.

## What I will NOT do unless you ask
- I won't touch Posts / Create / Profile-image preview behavior (already shipped).
- I won't change the existing seen-question de-dupe system; curriculum mode plugs into it.
- I won't add per-user OAuth; signup stays email + Google as today.

Approve and I'll execute Phase 1 → 4 in order, pausing only for the DB migrations.