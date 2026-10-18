# Hera web app: build guide

For engineers building pages in `apps/web` (Next.js 16 App Router, React 19, Tailwind CSS 4, Motion, TanStack Query).

## Design source of truth

Every screen has a finished design. These are HTML artboards, read them as the spec:
`/private/tmp/claude-501/-Users-olowutimilehin-Documents-Hera-Frontend/b4b502cb-4a1a-4995-9ac3-1cb70f435f7e/scratchpad/design/project/*.dc.html`

Match layout, copy, hierarchy and states closely. The artboards use inline styles and sample data; in the app, use the Tailwind tokens and components below and real API data. Sample numbers in the artboards are not real: never hardcode them.

## Tokens (app/globals.css)

- Colors: `paper`, `paper-2`, `card`, `ink`, `ink-soft`, `line` (borders), `sun`, `peacock`, `peacock-soft`, `iris`, `iris-soft`, `blush`, `blush-soft`, `tangerine`, and risk `risk-{low,medium,high,severe}` + `-soft`. Use them as Tailwind classes (`bg-paper-2`, `text-risk-severe`, `border-line`). Risk colors are only for risk.
- Fonts: `font-display` (Bricolage Grotesque, headings), `font-sans` (DM Sans), `font-mono` (DM Mono for addresses, hashes, amounts, codes).
- Shadows: `shadow-hard-sm`, `shadow-hard`, `shadow-hard-lg`. Surfaces: `brutal` (card + 2px line border + hard shadow, 16px radius). Buttons get `press` for the physical press effect (already inside `Button`).
- Utilities: `dot-grid`, `highlight` (sun underline), `eyebrow` (mono uppercase label).
- Text on `sun` is always `text-[#17130F]` (sun stays yellow in dark mode).
- Dark mode works through the CSS variables; never hardcode hex colors in pages, except `#17130F` text on sun.

## Components (import, don't re-implement)

- `@/components/brand/logo`: `Logo`, `HMark` (the real traced H mark).
- `@/components/brand/argus`: `Argus` mascot, `mood` = idle | scanning | happy | alarmed.
- `@/components/ui/button`: `Button`, `ButtonLink` (variants primary | ink | secondary | danger | ghost; sizes sm | md | lg; `loading`), `buttonStyles()`.
- `@/components/ui/card`: `Card`, `CardHeader`, `StatTile`.
- `@/components/ui/field`: `Field` (render prop gives `id`, `describedBy`, `invalid`), `Input` (`mono`), `Textarea`, `Select`, `FormError`, `VisuallyHidden`.
- `@/components/ui/badge`: `Tag` (mono chip), `Pill` (status), `RiskChip`, `DecisionPill`, `ChainTag`.
- `@/components/ui/stamp`: `Stamp` (CLEAR / REVIEW / BLOCKED slam).
- `@/components/ui/score-dial`: `ScoreDial`.
- `@/components/ui/dialog`: `Dialog` (accessible modal).
- `@/components/ui/misc`: `PageHeader`, `EmptyState`, `Skeleton`, `LoadingBlock`, `ErrorBlock`, `Address` (short + copy), `Segmented`, `Switch`, `DataTable`.
- `@/lib/risk`: `BAND_STYLE`, `DECISION_STYLE`, `SEVERITY_STYLE`, `SEVERITY_DOT`.
- `@/lib/format`: `timeAgo`, `formatDateTime`, `formatAmount`, `formatUsd`, `titleCase`.
- `@/lib/cn`: `cn()`.
- Icons: `lucide-react`. Never emoji.

## Data

- All API calls go through `@/lib/api` (`api.get/post/patch/delete`, `ApiError` with `status`, `code`, `message`, `fields`). Base path is `/api/v1`, proxied to the NestJS API. Cookies are first-party.
- Hooks for every endpoint are in `@/lib/queries` (`useMe`, `useScreen`, `useWallets`, `useAlerts`, `useTravelRuleTransfers`, `useReports`, `useWebhooks`, `useInvites`, …). Read it before writing a fetch.
- Types and zod schemas come from `@hera/core` (`packages/core/src/contract.ts` is the REST contract; `types.ts` has `ScreeningResult`, `Reason`, `Transfer`, …). Validate forms with the core zod schemas via `react-hook-form` + `@hookform/resolvers/zod`, and map `ApiError.fields` back onto form fields.
- The API spec is `apps/api/openapi.json`; the API README is `apps/api/README.md`.

## Rules

- Pages under `app/app/*` are client components inside `AppShell` (sidebar, top bar and auth guard are already done). Each page starts with `PageHeader`.
- Every data view handles loading (`LoadingBlock`/`Skeleton`), error (`ErrorBlock` with retry), and empty (`EmptyState` with a helpful action) states.
- Forms: a label on every control, inline field errors, a disabled/loading submit, `toast` (sonner) for success, `FormError` for request errors.
- Accessibility: real `<button>`/`<a>`, focus visible, `aria-*` on icon-only buttons, text contrast AA, touch targets ≥ 40px, layouts that work at 360px wide (`flex-wrap`, `overflow-x-auto` on tables).
- Respect reduced motion (`MotionConfig reducedMotion="user"` is global; avoid infinite animations that convey meaning).
- Copy: friendly, specific, short. Sentence case. No exclamation-mark spam. No invented stats.
- Don't edit shared files (`components/ui/*`, `components/app/*`, `components/brand/*`, `lib/*`, `app/layout.tsx`, `app/globals.css`, `app/providers.tsx`). If you need a new shared piece, create a new file under `components/<your-area>/` or `lib/hooks/<your-area>.ts`. If a shared file truly needs a change, describe it in your report.
- Verify with `pnpm --filter @hera/web exec tsc --noEmit --incremental false`. Do not run `next build` or `next dev`: other engineers share the `.next` folder.
