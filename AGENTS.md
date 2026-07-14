# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single client-side web app (no backend): an Arabic RTL field-research
data-collection dashboard built with **Vite + React + TypeScript**. All data is stored
in the browser's `localStorage`; there is no database or server to run.

### Running / building / checking

Standard scripts are defined in `package.json` (do not duplicate them here):

- Dev server: `npm run dev` → serves on `http://localhost:5173` (Vite, host enabled).
- Build: `npm run build`, preview: `npm run preview`.
- Checks: `npm run lint` (ESLint) and `npm run typecheck` (`tsc -b --noEmit`).

### Auth, roles & Supabase

- Login is handled by `src/lib/auth.tsx` (context). Two roles: `researcher` (data collection
  dashboard) and `company` (read-only portal showing reports where `targetCompany` = their company).
- **Demo mode** (when Supabase env is NOT set): built-in accounts `1111/1111` (researcher) and
  `2222/2222` (company → "شركة نخبة التسويق"). Session persists in `localStorage`.
- **Supabase**: configured via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (build-time env; the
  anon key is public). If present, `src/lib/supabase.ts` enables it and auth uses
  `signInWithPassword` (username is mapped to `<username>@demo.local`), reading role/company from a
  `profiles` table. Run `supabase/schema.sql` in the Supabase SQL editor (tables + RLS + storage bucket).
  NOTE: currently Supabase powers AUTH only; the places/photos DATA layer still uses local storage
  and is pending migration to Supabase tables/Storage.

### Data & media storage

- App state (sections + entries metadata) is stored as one JSON blob in `localStorage`
  (`src/storage.ts`). `loadData()` normalizes older entries for newer fields.
- **Photos are stored as JPEG blobs in IndexedDB** (`src/lib/media.ts`, DB `field-research-media`)
  — NOT in localStorage — to avoid the ~5MB quota. Entries keep only `PhotoRef` ({id, capturedAt}).
  `MediaImage` loads blobs as object URLs; PDF export converts them to data URLs.
- Photos are watermarked with capture date/time on a canvas before storage (`src/lib/image.ts`).
- Audio notes are still small data URLs inside the entry JSON (guarded to ~1.5MB each).
- `targetCompany` is per-entry ("الشركة المقدَّم إليها التقرير"); the list can be filtered by company.

### Non-obvious notes

- **HTTPS-only browser features**: geolocation (GPS) and the voice-to-text feature
  (Web Speech API) require a secure context and a browser permission grant. On plain
  `http://localhost` geolocation works in Chrome but the map/address auto-fill may be
  blocked in restricted/headless environments — this is expected, not a code bug.
  Manual address entry always works as a fallback.
- **Speech-to-text** uses `webkitSpeechRecognition` and only works in Chromium browsers
  (Chrome/Edge); it silently degrades to manual typing elsewhere.
- **Reverse geocoding** calls the public OpenStreetMap Nominatim API (no key). It needs
  outbound network access; failures fall back to manual address entry.
- **Google Maps** is embedded via the public `output=embed` URL — no API key required.
- **PDF export** renders an off-screen HTML report with `html2canvas` + `jsPDF` (rasterized)
  so Arabic RTL text renders correctly; PDFs are image-based and can be several MB.
- **Deployment target is Cloudflare Workers (Static Assets)** via `wrangler.jsonc`:
  deploy with `npx wrangler deploy` (also `npm run deploy`). `wrangler deploy` runs
  `npm run build` itself through `build.command` in `wrangler.jsonc`, then uploads `dist/`.
  SPA routing is handled by `assets.not_found_handling: "single-page-application"`.
  - Two layers protect against the wrangler "Vite cannot be automatically configured"
    deploy error: (1) the explicit `wrangler.jsonc` bypasses wrangler's framework
    auto-detection entirely, and (2) the project runs **Vite 6** so that even if the
    auto-detection path runs, it can configure successfully (wrangler requires Vite >= 6).
    Do NOT remove `wrangler.jsonc` and do NOT downgrade Vite below 6.
  - IMPORTANT delivery note: this error also appears when Cloudflare builds a **stale
    commit** that predates these fixes (symptom in build logs: only ~230 packages
    installed and `wrangler ... not found and will be installed`). Ensure Cloudflare
    deploys the latest commit of the connected branch (a "Retry" reuses the old commit SHA).
  - Validate deploy config without credentials using `npx wrangler deploy --dry-run`.
  - Do NOT add a `public/_redirects` catch-all (`/* /index.html 200`) for the Workers deploy;
    it triggers a deploy-time "Infinite loop detected" error (code 100324). SPA routing is
    handled by `not_found_handling`. (`_redirects` is only for the Cloudflare Pages alternative.)
  - Cloudflare Pages also works as a static alternative (build `npm run build`, output `dist`;
    add `public/_redirects` with `/* /index.html 200` only for Pages).
