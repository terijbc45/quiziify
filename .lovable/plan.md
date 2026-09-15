# Complete Quiziify reliability and curriculum rebuild

## Goal
Finish the previously requested features without regressing completed work, and make every displayed textbook and chapter list traceable to a genuine Nepal CDC or explicitly named trusted-publisher source.

## 1. Full feature audit
- Check every requested area: Home calendar/captions and progress, profile photos/posts/class/optional subjects, Chapters, Test Mode, Ramailo categories, quiz prefetch and anti-repeat behavior, reminders, authentication, and MCP tools.
- Preserve working behavior and change only missing, broken, or misleading parts.
- Maintain a completion checklist so no historical request is silently skipped.

## 2. Genuine curriculum and textbook pipeline
- Stop using AI to invent or choose subject catalogs and chapter names.
- Discover official CDC textbook pages directly from `moecdc.gov.np`, with Firecrawl as an enhancement rather than a single point of failure.
- Add strict class, subject, document-type, and source-domain validation before accepting a book.
- For scanned/image-only PDFs, add an OCR-capable extraction path suitable for the deployed runtime; otherwise expose the real book without pretending its chapter list was parsed.
- Parse chapter titles and order deterministically from the actual contents pages. AI may only add clearly labeled summaries or learning aids after the source titles are fixed.
- Support trusted Nepal publishers only when their real book page or contents evidence is available; display the publisher instead of calling it an official CDC book.
- Cache source records with versioning, provenance, edition metadata, cover URL, extraction status, and the exact chapter list.

## 3. Source-transparent chapter experience
- Show the actual cover when available, source/publisher, verification state, and a link to the original page or PDF.
- Distinguish “official CDC”, “trusted publisher”, “temporarily unavailable”, and “book found but contents unreadable”.
- Remove misleading verified labels and prevent stale generated chapter lists from appearing as genuine.
- Keep chapter actions for quiz, interactive flashcards, and podcasts.

## 4. Grounded study tools
- Fix AI request authentication and use supported current models.
- Ground chapter quizzes, flashcards, and podcast scripts in the selected book and chapter source, not merely the book’s front matter.
- Keep English/Nepali output selection and surface exact service errors with safe retry behavior.

## 5. Quiz reliability
- Verify Test, Chapters, GK, Logo, Places, and Food & Animals all produce complete matches.
- Enforce 10–20 unique questions per Ramailo match and fresh questions in subsequent matches.
- Verify background preparation supplies the next match quickly without reusing consumed batches.
- Keep questions concise while allowing necessary context; keep answers short.
- Preserve real-image behavior for logos, flags, landmarks, foods, and animals, with graceful image fallback.

## 6. App-wide regression and error pass
- Verify all prior visual and interaction requests across Home, Profile, Posts, Play, Chapters, Test, Ramailo, and Reminders.
- Resolve build, type, runtime, hydration, navigation, and failed-request issues affecting normal use.
- Confirm each content page has correct metadata.
- Test authenticated end-to-end flows and responsive layouts before completion.

## Technical details
- Keep server-only source fetching and AI calls behind authenticated server functions.
- Use direct HTTPS fetching and deterministic parsing for official CDC pages/PDFs; use Firecrawl only when its connection is available.
- Use a Worker-compatible OCR or external document extraction path; do not add native filesystem/process dependencies.
- Version curriculum cache keys so inaccurate legacy entries are bypassed.
- Validate every accepted source against class, subject, source domain, and textbook markers.
- Respect AI gateway status handling: terminal errors are shown, and only rate limits/server failures receive bounded retries.

## Acceptance criteria
- Class 11 Nepali resolves the real CDC book even when Firecrawl has no credits.
- Every chapter title shown matches the linked book’s contents and preserves its order.
- No AI-generated chapter title can be marked as source-verified.
- Flashcards and podcasts launch successfully from a selected chapter and remain source-grounded.
- Every Ramailo match has 10–20 unique questions, including repeat matches.
- The app builds cleanly and the main authenticated flows run without blocking console/runtime errors.
