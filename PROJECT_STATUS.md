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
- **Production branch**: `main` — merging triggers a Netlify production deploy; branch is protected (direct push rejected)
- **Active feature branch**: `claude/lineup-ui-redesign` — LineUp UI redesign; tested end-to-end, ready to merge via PR
- **Local dev path**: `/home/user/next-platform-starter` (Linux dev environment)

---

## Current Status

### Working in production (on `main`)
- Supabase project connected; Google OAuth working on the production Netlify URL
- `proxy.js` (Next.js 16 auth middleware) gates all `/app/*` routes; checks `user_app_access` table for per-user, per-app access
- Portfolio pages: home, work timeline, projects cards
- Login flow: `/login` → Google OAuth → `/auth/callback` → redirect to originally requested URL
- Sign-out via POST to `/auth/signout`
- LineUp app (v1 slider UI) is on `main`; the redesign below is on the feature branch

### Feature branch: `claude/lineup-ui-redesign` (ready to merge via PR)

All of the following is implemented and tested end-to-end:

- **Redesigned SVG lane** — interactive drag-crosshair input; 39 boards; oil pattern line; pin glyphs; approach zone
- **Dual foot position tracking** — approach split into two drag strips: upper (slide/foul-line foot), lower (start/setup foot). Slide foot drives all ball-path and breakpoint calculations; start foot stored for drift validation
- **Plan → Record flow** — plan mode sets foot + target (brk always derived); entering record pre-fills slide foot = start + drift; player adjusts after the shot; save commits to in-memory state and Supabase
- **Supabase persistence** — sessions, balls, and shots written fire-and-forget on each save; in-memory state is always source of truth
- **Session review** — "Past sessions" in hamburger menu opens a drawer: list of sessions (date, pattern, balls, shot count) → detail view (lane overlay of all shots + stats strip + read-only shot list)
- **Ball catalog** — existing balls loaded from Supabase on setup; "From bag" dropdown or "New ball" form; surface write-back on session start
- **Role-based access** — `user_app_access.role` is now a typed enum (`app_role`: viewer / user / admin); middleware grants entry to any non-null row; role enforcement for future admin features
- **Marker UX** — all lane markers have dark+coloured pill labels; interactive markers expand with halo on touch; pills at 6 o'clock when idle, 9 o'clock (RH) / 3 o'clock (LH) when dragging

---

## Key Technical Decisions

- **Next.js 16 App Router** with React 19, Turbopack (prod), React Compiler (`babel-plugin-react-compiler`)
- **`proxy.js`** replaces deprecated `middleware.js` in Next.js 16; exported function must be named `proxy`
- **Supabase SSR** (`@supabase/ssr` v0.10.3) with `createBrowserClient` / `createServerClient`
- **Google OAuth** only works on the production Netlify URL (not preview URLs). Localhost works via explicit redirect URI registration.
- **`app/app/layout.jsx`** overrides the root layout for all `/app/*` routes, giving apps a full-screen shell
- **Tailwind CSS v4** with dark slate theme for the portfolio; LineUp uses its own `--lu-*` CSS variable palette (warm dark, orange/blue/green/yellow accents)
- **Bare imports** (`'lib/supabase/client'`) cause silent hydration failure in Turbopack — always use relative paths (`'../../lib/supabase/client'`)
- **LineUp SVG geometry**: `preserveAspectRatio="xMidYMid meet"` with CSS `aspect-ratio: 390 / 660`
- **In-memory state is source of truth**: Supabase writes are fire-and-forget. The app works fully offline/unauthenticated; DB persistence is additive.
- **Supabase signups**: "Disable new user signups" must be OFF for new testers to create accounts. New users also require a row in `user_app_access` with `app_slug = 'lineup'` and the appropriate role.

---

## Project File Structure

```
next-platform-starter/
  proxy.js                  <- auth middleware (gates /app/* routes, checks user_app_access)
  next.config.js            <- reactCompiler: true, turbopack.root: '../'
  PROJECT_STATUS.md         <- this file
  BACKLOG.md                <- feature backlog with priorities
  lib/
    supabase/
      client.js             <- createBrowserClient
      server.js             <- createServerClient (uses next/headers)
    lineup/
      constants.js          <- CONSTANTS singleton, initSession
      models.js             <- Line class, LaneRead class (pure logic, no DOM)
      state.js              <- session state, recordShot(planned, actual), getShotHistory, export/import
  components/
    lineup/
      Lane.jsx              <- interactive SVG lane; drag zones split by mode; reviewShots = read-only overlay
      Drawer.jsx            <- reusable left/right slide-in drawer shell
      SetupScreen.jsx       <- session setup form; loads ball catalog + user profile defaults from Supabase
      ShotHistory.jsx       <- shot list; onEdit/onRemove optional (omit = read-only)
      HamburgerMenu.jsx     <- left-side menu drawer (balls, display tweaks, session actions)
      SessionReview.jsx     <- read-only past-session browser (list → detail with lane overlay + stats)
  app/
    app/
      lineup/
        page.jsx            <- server component, auth guard
        lineup-app.jsx      <- 'use client' main orchestrator
        actions.js          <- server actions for all Supabase CRUD
```

---

## LineUp App — Domain & Logic

LineUp helps a tenpin bowler read a lane by tracking shots and making positional recommendations.

**Key domain concepts:**
- The lane has 39 boards (board 1 = right gutter for RH, board 39 = left gutter)
- The oil pattern has a length (e.g. 42 ft); the **rule of 31** gives the expected breakpoint board (`patternLength - 31`)
- A `Line` represents one shot: foot position, ball start, target at the arrows, breakpoint, and finish position
- `boardsCrossed = (ballStart - breakpoint) + (finishPosition - breakpoint)` — total hook swing amplitude
- The `LaneRead` class accumulates shots, computes a weighted lane breakpoint, builds a move table, and predicts the next row

**Dual foot model:**
- `startFoot` — where the bowler sets up (stored as `line.footStart` metadata)
- `slideFoot` — where they finish at the foul line (stored as `line.foot`, drives all calculations)
- `slideFoot = startFoot + drift` (pre-filled on entering record mode; player can adjust independently)
- `ballRelease = slideFoot - ballOffset`

**Interaction model:**
- **Plan mode**: start foot and target are the two draggable inputs; breakpoint always derived
- **Record mode**: both foot strips are independently draggable; target and finish also adjustable
- **Breakpoint** is always derived (`LaneRead.expectedBreakpoint(slideFoot, target)`) — never interactive

**Move table:** uses a 1.68x ratio (empirical approximation of lane geometry). Valid discrete moves: 2/1, 3/2, 5/3, 7/4, 8/5, 10/6 (foot/target).

**Handedness:** right-handed bowlers see board 1 on the right of the SVG. SVG always renders physical board 1 on the left; coordinate transform maps bowler boards to SVG x positions.

---

## Database Schema (Supabase project: `iltwtfzgaetieixcjikk`)

### Enums
| Enum | Values |
|---|---|
| `cover_stock_type` | solid, pearl, hybrid, urethane |
| `ball_surface` | 180, 360, 500, 1000, 2000, 4000, Compound, Polish |
| `hand_type` | R, L |
| `handedness_type` | right, left |
| `app_role` | viewer, user, admin |

### Tables

**`user_app_access`** — controls which users can access which apps; checked by middleware
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | = auth.uid() |
| `app_slug` | text | e.g. `'lineup'` |
| `role` | app_role | default `'viewer'`; middleware admits any role |
| `created_at` | timestamptz | |

**`user_profiles`** — delivery defaults; upserted on each session start
| Column | Type |
|---|---|
| `user_id` | uuid PK |
| `hand` | hand_type (R/L) |
| `ball_to_slide_foot` | numeric |
| `drift` | numeric |
| `updated_at` | timestamptz |

**`balls`** — equipment catalog per user; shared across sessions
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | |
| `name` | text | |
| `manufacturer` | text | nullable |
| `weight` | numeric | nullable |
| `cover_stock_type` | cover_stock_type | nullable |
| `surface` | ball_surface | nullable; updated on surface write-back |
| `surface_changed_on` | date | nullable; set when surface changes |
| `serial_number` | text | nullable |
| `is_active` | boolean | default true |
| `created_at` | timestamptz | |

Surface write-back rule: if `lineup_balls.surface != balls.surface`, update `balls.surface` and `balls.surface_changed_on = today`.

**`lineup_sessions`** — one row per session; snapshots delivery parameters
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | |
| `pattern_label` | text | nullable; shown on lane SVG |
| `pattern_length` | integer | |
| `handedness` | handedness_type | `'right'` / `'left'`; UI normalises to R/L via `fromDbHand` |
| `ball_to_slide_foot` | numeric | |
| `drift` | numeric | |
| `created_at` | timestamptz | |

**`lineup_balls`** — junction between session and ball(s); records surface at time of use
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid | |
| `ball_id` | uuid | FK to `balls.id` |
| `user_id` | uuid | required for RLS |
| `surface` | ball_surface | nullable |
| `sort_order` | integer | default 0 |

**`lineup_shots`** — individual shot records with planned and actual values
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid | |
| `ball_id` | uuid | FK to `lineup_balls.id` |
| `user_id` | uuid | required for RLS |
| `shot_number` | integer | 1-based within session |
| `planned_foot` | integer | start foot at time of planning |
| `planned_target` | integer | |
| `planned_brk` | integer | derived breakpoint at time of planning |
| `actual_foot_start` | integer | start/setup foot (where bowler began approach) |
| `actual_foot_slide` | integer | nullable; slide foot at foul line (drives ball path) |
| `actual_target` | integer | |
| `actual_brk` | integer | derived from actual slide foot + target |
| `actual_finish` | integer | |
| `boards_crossed` | numeric | nullable; computed lane-read metric |
| `created_at` | timestamptz | |

All tables have RLS enabled. `lineup_shots` is accessible via `user_id = auth.uid()` directly.

---

## Server Actions (`app/app/lineup/actions.js`)

All actions require an authenticated Supabase session. DB `handedness` (`right`/`left`) is normalised to `hand` (`R`/`L`) by `toDbHand` / `fromDbHand` helpers.

| Action | Purpose |
|---|---|
| `getUserProfile()` | Fetch user_profiles row |
| `upsertUserProfile({ hand, ball_to_slide_foot, drift })` | Create or update profile |
| `getBalls()` | List ball catalog ordered by name |
| `createBall({ name, manufacturer, cover_stock_type, surface, serial_number })` | Add ball to catalog |
| `updateBallSurface(ballId, surface)` | Update surface + surface_changed_on |
| `createSession({ pattern_label, pattern_length, hand, ball_to_slide_foot, drift })` | Start session, returns session UUID |
| `addBallToSession({ session_id, ball_id, surface })` | Link ball to session; triggers surface write-back |
| `saveShot({ session_id, ball_id, shot_number, planned_foot, planned_target, planned_brk, actual_foot_start, actual_foot_slide, actual_target, actual_brk, actual_finish })` | Persist a shot |
| `getSessionShots(sessionId)` | Fetch shots for a session |
| `getSessions()` | List all sessions (newest first) with shot counts and ball names |
| `getSessionDetail(sessionId)` | Fetch session row + all shots |

---

## LineUp UI Flow

```
/app/lineup (server, auth guard)
  LineupApp (client orchestrator)
    SetupScreen          -- new session form (loads ball catalog + user profile defaults)
    [session active]
      Header             -- session meta (pattern, hand, drift), shot count pill
      Lane               -- SVG lane with drag zones:
                            plan mode:   foot_start + target draggable; brk display-only
                            record mode: foot_start + foot_slide + target + finish draggable
                            review mode: reviewShots prop → read-only historical path overlay
      Tabs               -- Plan / Record (/ Edit shot)
      Readout chips      -- Foot (start→slide) · Target · Exp BP · [Finish in record]
      Action button      -- "Plan looks good →" / "Save shot"
      Drawers
        history    → ShotHistory (with edit/remove)
        sessions   → SessionReview (list → detail, read-only)
        menu       → HamburgerMenu (balls, display tweaks, session actions incl. Past sessions)
```
