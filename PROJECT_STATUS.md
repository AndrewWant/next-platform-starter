# Project Status

## Project Aims

Personal/professional portfolio website for Andrew Want (PhD, VP Product Owner at JPMorganChase).
Built with **Next.js 16 App Router**, hosted on **Netlify**, authentication via **Supabase** (Google OAuth).

The site has two layers:
1. **Public portfolio** — home, work history, projects pages (static, no auth required)
2. **Gated apps** — sub-applications accessible only to authenticated, allowlisted users, served under `/app/[slug]`

The first gated app is **LineUp** — a tenpin bowling lane-read tool, ported from a standalone HTML/vanilla JS codebase into the Next.js portfolio at `/app/lineup`.

---

## Repository & Branches

- **Repo**: `andrewwant/next-platform-starter` (GitHub)
- **Production branch**: `main` — merging triggers a Netlify production deploy
- **Active feature branch**: `claude/lineup-ui-redesign` — LineUp UI redesign (untested, see below)
- **Local dev path**: `C:\ajw\local-dev\next-platform-starter` (Windows) / `/home/user/next-platform-starter` (Linux dev environment)

---

## Current Status

### Working in production (on `main`)
- Supabase project connected; Google OAuth working on the production Netlify URL
- `proxy.js` (Next.js 16 auth middleware, exported as `proxy` not `middleware`) gates all `/app/*` routes
- `user_app_access` table in Supabase controls per-app access per user
- Portfolio pages: home, work timeline, projects cards
- Login flow: `/login` → Google OAuth → `/auth/callback` → redirect to originally requested URL
- Sign-out via POST to `/auth/signout`
- LineUp app (v1 slider UI) merged to `main` and deployed

### In development — LineUp UI redesign (branch: `claude/lineup-ui-redesign`)

> ⚠️ **Currently untested.** The redesign has been implemented and committed but has not yet been run in the dev environment or verified end-to-end. Testing is the immediate next step before merging to `main`.

The redesign replaces the slider-based input UI with an interactive SVG lane. Key changes:

- **Interactive lane SVG** (`components/lineup/Lane.jsx`) — the bowler drags directly on the lane to set values at their physical position. A coloured crosshair overlay tracks the drag. All four zones are active:
  - Approach → foot (now active in **both** plan and record modes)
  - Below arrow line → target
  - Above arrow line / at pattern end → breakpoint
  - Pin deck strip → finish (record mode only)
- **Correct ball path Bézier** — path starts at the ball release point at the foul line (`slideFoot - ballOffset`), passes through target at the arrows, through the breakpoint at the pattern end line, and arrives at the finish board on the pin deck. Plan mode uses board 17 as finish; record mode uses the actual finish.
- **Intention vs actual shot model** — each saved shot now stores both the planned line (`planned: {foot, target, brk, finish: 17}`) and the actual result (`actual: {foot, target, brk, finish}`). `LaneRead` calculations use actual values; planned values travel with the shot for future accuracy analysis.
- **Exploration-shot logic** — if the first shot hits the pocket (±1 board) AND the breakpoint is near the rule-of-31 base (±3 boards), the suggestion is a +3 board parallel shift inside rather than a move-table lookup. This gathers lane shape data rather than repeating a line already found.
- **New component set**: `SetupScreen`, `Drawer`, new `ShotHistory` (actual + dimmed planned row), new `HamburgerMenu` (left-side drawer). Old `SliderOverlay`, `SuggestionRow`, `SetupModal` removed.
- **Warm dark palette** — `--lu-*` CSS variables in `globals.css`; aspect-ratio-constrained lane layout.

### Local dev environment
- **Resolved**: Linux dev environment (`/home/user/next-platform-starter`) works with `npm run dev`. The Turbopack workspace-root bug documented in `LOCAL_DEV_ISSUE.md` was Windows-specific and does not reproduce on Linux.
- **Google OAuth on localhost**: configured — `http://localhost:3000/auth/callback` added to Supabase Auth redirect URLs and Google Cloud Console.
- `.env.local` required with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Key Technical Decisions

- **Next.js 16 App Router** with React 19, Turbopack (prod), React Compiler (`babel-plugin-react-compiler`)
- **`proxy.js`** replaces deprecated `middleware.js` in Next.js 16; exported function must be named `proxy`
- **Supabase SSR** (`@supabase/ssr` v0.10.3) with `createBrowserClient` / `createServerClient`
- **Google OAuth** only works on the production Netlify URL (not preview URLs — Public Suffix List restriction). Localhost works via explicit redirect URI registration.
- **`app/app/layout.jsx`** overrides the root layout for all `/app/*` routes, giving apps a full-screen shell
- **Tailwind CSS v4** with dark slate theme for the portfolio; LineUp uses its own `--lu-*` CSS variable palette (warm dark, orange/blue/green/yellow accents)
- **Bare imports** (`'lib/supabase/client'`) cause silent hydration failure in Turbopack — always use relative paths (`'../../lib/supabase/client'`)
- **LineUp SVG geometry**: `preserveAspectRatio="xMidYMid meet"` with CSS `aspect-ratio: 390 / 660` — lane maintains correct proportions at all viewport sizes

---

## Project File Structure

```
next-platform-starter/
  proxy.js                  ← auth middleware (gates /app/* routes)
  next.config.js            ← reactCompiler: true, turbopack.root: '../'
  package.json
  node_modules/
  lib/
    supabase/
      client.js             ← createBrowserClient
      server.js             ← createServerClient (uses next/headers)
    lineup/
      constants.js          ← CONSTANTS singleton, initSession, encodeSessionURL
      models.js             ← Line class, LaneRead class (pure logic, no DOM)
      state.js              ← session state, recordShot(planned, actual), export/import
  components/
    header.jsx
    footer.jsx
    sign-out-button.jsx
    lineup/
      Lane.jsx              ← interactive SVG lane with pointer-drag crosshair
      Drawer.jsx            ← reusable left/right slide-in drawer shell
      SetupScreen.jsx       ← session setup form (new warm-palette design)
      ShotHistory.jsx       ← 4-col history: actual values + dimmed planned row
      HamburgerMenu.jsx     ← left-side menu drawer (balls, display, session)
  app/
    layout.jsx              ← root layout (portfolio header/footer)
    page.jsx                ← home page
    login/
      page.jsx              ← server wrapper
      login-form.jsx        ← 'use client', Google OAuth button
    auth/
      callback/route.js     ← exchanges OAuth code for session
      signout/route.js      ← POST handler, signs out and redirects
    work/page.jsx
    projects/page.jsx
    app/
      layout.jsx            ← full-screen shell (no portfolio header/footer)
      [slug]/page.jsx       ← generic gated app placeholder
      lineup/
        page.jsx            ← server component, auth guard
        lineup-app.jsx      ← 'use client' main orchestrator (new design)
  styles/
    globals.css             ← Tailwind v4 + --lu-* CSS vars + lineup layout classes
```

---

## LineUp App — Domain & Logic

LineUp helps a tenpin bowler read a lane by tracking shots and making positional recommendations.

**Key domain concepts:**
- The lane has 39 boards (board 1 = right gutter for RH, board 39 = left gutter)
- The oil pattern has a length (e.g. 42 ft); the "rule of 31" gives the expected breakpoint board (`patternLength - 31`)
- A `Line` represents one shot: foot position, ball start, target at the arrows, breakpoint (where the ball exits the oil and hooks), and finish position at the pins
- `boardsCrossed = (ballStart - breakpoint) + (finishPosition - breakpoint)` — total hook swing amplitude
- The `LaneRead` class accumulates shots, computes a weighted lane breakpoint, builds a move table (39 target positions routing the ball to the pocket at board 17), and predicts which row the player should use next

**Breakpoint weighting:** shots whose breakpoint is close to the rule-of-31 board get higher weight; shots whose finish is close to board 17 (pocket) get higher weight. Both factors multiply together.

**Move table:** uses a 1.68× ratio (empirical approximation of lane geometry) — for every 1 board of target adjustment, foot moves ~1.68 boards. Valid discrete moves: 2/1, 3/2, 5/3, 7/4, 8/5, 10/6 (foot/target).

**Handedness:** right-handed bowlers see board 1 on the right of the SVG lane (matching the physical lane from their perspective). The SVG always renders physical board 1 on the left; a coordinate transform maps bowler boards to SVG x positions.

**Exploration shot (first-shot special case):** if the first shot hits the pocket (finish within 1 board of board 17) AND the breakpoint is near the rule-of-31 base (within ±3 boards), the suggestion is a +3 board parallel shift inside (same direction for both handedness — away from the bowler's ball-side gutter) rather than a move table lookup. This gathers lane shape information rather than confirming a line already found.

**Bugs fixed during original port from vanilla JS:**
1. Breakpoint weighting used `line.target` in distance formula — should be `line.breakpoint`
2. `_calcBreakpoint` averaged `line.target` values — should average `line.breakpoint` values
3. Anchor (phantom prior line with degenerate values) removed from all calculations
4. 1-shot prediction now uses that shot's `boardsCrossed` directly (not interpolated with anchor)
5. `deltaBoardsCrossed === 0` fallback now correctly averages the two shots' boardsCrossed
6. `importSessionJSON` was calling `initSession` without importing it
7. `ANCHOR_FINISH` formula recalibrated: `49 - 0.9×patternLength` (was `62 - 1.25×patternLength`)
