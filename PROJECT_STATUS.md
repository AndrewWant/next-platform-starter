# Project Status

## Project Aims

Personal/professional portfolio website for Andrew Want (PhD, VP Product Owner at JPMorganChase).
Built with **Next.js 16 App Router**, hosted on **Netlify**, authentication via **Supabase** (Google OAuth).

The site has two layers:
1. **Public portfolio** — home, work history, projects pages (static, no auth required)
2. **Gated apps** — sub-applications accessible only to authenticated, allowlisted users, served under `/app/[slug]`

The first gated app is **LineUp** — a tenpin bowling lane-read tool, ported from a standalone HTML/vanilla JS codebase into the Next.js portfolio at `/app/lineup`.

---

## Repository & Branch

- **Repo**: `andrewwant/next-platform-starter` (GitHub)
- **Active feature branch**: `claude/nextjs-portfolio-site-7zKbp`
- **Production branch**: `main` (merging to main triggers a Netlify production deploy)
- **Local path**: `C:\ajw\local-dev\next-platform-starter`

---

## Current Status

### Working in production
- Supabase project connected; Google OAuth working on the production Netlify URL
- `proxy.js` (Next.js 16 auth middleware, exported as `proxy` not `middleware`) gates all `/app/*` routes
- `user_app_access` table in Supabase controls per-app access per user
- Portfolio pages: home, work timeline, projects cards
- Login flow: `/login` → Google OAuth → `/auth/callback` → redirect to originally requested URL
- Sign-out via POST to `/auth/signout`

### Complete but undeployed (on feature branch, not yet merged to main)
- **LineUp app** fully ported to React/Next.js at `app/app/lineup/`
- **Pure logic** in `lib/lineup/` (constants.js, models.js, state.js) — no DOM dependencies
- **React UI** in `components/lineup/` (SetupModal, SuggestionRow, SliderOverlay, ShotHistory, HamburgerMenu)
- **`app/app/layout.jsx`** — full-screen shell layout for gated app routes (suppresses portfolio header/footer)
- Several logic bugs from the original codebase fixed during the port (see LineUp section below)

### Blocked
- **Cannot deploy**: Netlify build budget exhausted for the month (20 builds/month limit)
- **Cannot run locally**: Turbopack error prevents `npx next dev` from working (see `LOCAL_DEV_ISSUE.md`)

---

## Key Technical Decisions

- **Next.js 16 App Router** with React 19, Turbopack (prod), React Compiler (`babel-plugin-react-compiler`)
- **`proxy.js`** replaces deprecated `middleware.js` in Next.js 16; exported function must be named `proxy`
- **Supabase SSR** (`@supabase/ssr` v0.10.3) with `createBrowserClient` / `createServerClient`
- **Google OAuth** only works on the production Netlify URL (not preview URLs — Public Suffix List restriction)
- **`app/app/layout.jsx`** overrides the root layout for all `/app/*` routes, giving apps a full-screen shell
- **Tailwind CSS v4** with dark slate theme; LineUp uses green accent colours
- **Bare imports** (`'lib/supabase/client'`) cause silent hydration failure in Turbopack — always use relative paths (`'../../lib/supabase/client'`)

---

## Project File Structure

```
next-platform-starter/
  proxy.js                  ← auth middleware (gates /app/* routes)
  next.config.js            ← reactCompiler: true
  package.json
  node_modules/
  lib/
    supabase/
      client.js             ← createBrowserClient
      server.js             ← createServerClient (uses next/headers)
    lineup/
      constants.js          ← CONSTANTS singleton, initSession, encodeSessionURL
      models.js             ← Line class, LaneRead class (pure logic, no DOM)
      state.js              ← session state, recordShot, importSessionJSON, etc.
  components/
    header.jsx
    footer.jsx
    sign-out-button.jsx
    lineup/
      SetupModal.jsx
      SuggestionRow.jsx
      SliderOverlay.jsx
      ShotHistory.jsx
      HamburgerMenu.jsx
  app/
    layout.jsx              ← root layout (portfolio header/footer)
    page.jsx                ← home page
    login/
      page.jsx              ← server wrapper (passes searchParams to client)
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
        lineup-app.jsx      ← 'use client' main orchestrator
  styles/
    globals.css             ← Tailwind v4 + lineup slider CSS
```

---

## LineUp App — Domain & Logic

LineUp helps a tenpin bowler read a lane by tracking shots and making positional recommendations.

**Key domain concepts:**
- The lane has 39 boards (board 1 = right gutter, board 39 = left gutter)
- The oil pattern has a length (e.g. 42 ft); the "rule of 31" gives the expected breakpoint board (`patternLength - 31`)
- A `Line` represents one shot: foot position, ball start, target at the arrows, breakpoint (where the ball exits the oil and hooks), and finish position at the pins
- `boardsCrossed = (ballStart - breakpoint) + (finishPosition - breakpoint)` — total hook swing amplitude
- The `LaneRead` class accumulates shots, computes a weighted lane breakpoint, builds a move table (39 target positions routing the ball to the pocket at board 17), and predicts which row the player should use next

**Breakpoint weighting:** shots whose breakpoint is close to the rule-of-31 board get higher weight; shots whose finish is close to board 17 (pocket) get higher weight. Both factors multiply together.

**Move table:** uses a 1.68× ratio (empirical approximation of lane geometry) — for every 1 board of target adjustment, foot moves ~1.68 boards. Valid discrete moves: 2/1, 3/2, 5/3, 7/4, 8/5, 10/6 (foot/target).

**Handedness:** right-handed bowlers get RTL sliders in the UI (board 1 on the right, matching the physical lane from their perspective).

**Bugs fixed during port:**
1. Breakpoint weighting used `line.target` in distance formula — should be `line.breakpoint`
2. `_calcBreakpoint` averaged `line.target` values — should average `line.breakpoint` values
3. Anchor (phantom prior line with degenerate values) removed from all calculations
4. 1-shot prediction now uses that shot's `boardsCrossed` directly (not interpolated with anchor)
5. `deltaBoardsCrossed === 0` fallback now correctly averages the two shots' boardsCrossed
6. `importSessionJSON` was calling `initSession` without importing it
7. `ANCHOR_FINISH` formula recalibrated: `49 - 0.9×patternLength` (was `62 - 1.25×patternLength`)

**1-shot special case:** if the first shot hits the pocket (finish within 1 board of board 17), the suggestion is a parallel shift 3 boards inside (toward higher boards for right-handed) rather than a move table lookup — this gathers lane shape information rather than confirming a line already found.
