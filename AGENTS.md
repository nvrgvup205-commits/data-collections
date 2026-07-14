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
  - The explicit `wrangler.jsonc` is intentional: it bypasses wrangler's Vite framework
    auto-detection, which otherwise errors demanding Vite >= 6 ("cannot be automatically
    configured"). Do NOT remove `wrangler.jsonc` or that error returns on deploy.
  - Validate deploy config without credentials using `npx wrangler deploy --dry-run`.
  - Cloudflare Pages also works as a static alternative (build `npm run build`, output `dist`,
    `public/_redirects` for SPA fallback).
