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
- **Active feature branch**: `claude/lineup-ui-redesign` — LineUp UI redesign (untested end-to-end)
- **Local dev path**: `/home/user/next-platform-starter` (Linux dev environment)

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

> Warning: Currently untested end-to-end. The redesign has been implemented and committed but has not yet been verified against a live Supabase session. Testing is required before merging to `main`.

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

---

## Project File Structure

```
next-platform-starter/
  proxy.js                  <- auth middleware (gates /app/* routes)
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
      state.js              <- session state, recordShot(planned, actual), export/import
  components/
    lineup/
      Lane.jsx              <- interactive SVG lane; reviewShots prop enables read-only overlay mode
      Drawer.jsx            <- reusable left/right slide-in drawer shell
      SetupScreen.jsx       <- session setup form; loads ball catalog from Supabase on mount
      ShotHistory.jsx       <- shot list; onEdit/onRemove optional (omit = read-only)
      HamburgerMenu.jsx     <- left-side menu drawer (balls, display tweaks, session actions)
      SessionReview.jsx     <- read-only past-session browser (list -> detail with lane overlay)
  app/
    app/
      lineup/
        page.jsx            <- server component, auth guard
        lineup-app.jsx      <- 'use client' main orchestrator
        actions.js          <- server actions for all Supabase CRUD
```

---

## LineUp App - Domain & Logic

LineUp helps a tenpin bowler read a lane by tracking shots and making positional recommendations.

**Key domain concepts:**
- The lane has 39 boards (board 1 = right gutter for RH, board 39 = left gutter)
- The oil pattern has a length (e.g. 42 ft); the **rule of 31** gives the expected breakpoint board (`patternLength - 31`)
- A `Line` represents one shot: foot position, ball start, target at the arrows, breakpoint, and finish position
- `boardsCrossed = (ballStart - breakpoint) + (finishPosition - breakpoint)` — total hook swing amplitude
- The `LaneRead` class accumulates shots, computes a weighted lane breakpoint, builds a move table, and predicts the next row

**Interaction model (plan mode):**
- **Foot** and **target** are the two draggable primary inputs
- **Breakpoint** is always derived: `brk = LaneRead.expectedBreakpoint(slideFoot, planTarget)` — never stored as state, never interactive
- This matches how bowlers think: 2:1 moves (foot:target) keep breakpoint approximately stable
- `slideFoot = setupFoot + drift`; `ballRelease = slideFoot - ballOffset`

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

### Tables

**`user_profiles`** — current delivery defaults; upserted on each session start
| Column | Type |
|---|---|
| `user_id` | uuid PK (= auth.uid()) |
| `hand` | hand_type |
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
| `serial_number` | text | nullable |
| `cover_stock` | cover_stock_type | nullable |
| `surface` | ball_surface | nullable; updated when surface changes |
| `surface_changed_on` | date | set when surface is changed |
| `notes` | text | nullable |

Surface write-back rule: if `lineup_balls.surface != balls.surface`, update `balls.surface` and `balls.surface_changed_on = today`.

**`lineup_sessions`** — one row per session; snapshots delivery parameters
| Column | Type |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid |
| `pattern_name` | text (nullable) |
| `pattern_length` | integer |
| `hand` | hand_type |
| `ball_to_slide_foot` | numeric |
| `drift` | numeric |
| `created_at` | timestamptz |

**`lineup_balls`** — junction between session and ball(s); records surface at time of use
| Column | Type |
|---|---|
| `id` | uuid PK |
| `session_id` | uuid |
| `ball_id` | uuid |
| `surface` | ball_surface |
| `notes` | text (nullable) |

**`lineup_shots`** — individual shot records with planned and actual values
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid | |
| `lineup_ball_id` | uuid | |
| `shot_number` | integer | 1-based within session |
| `planned_foot` | integer | nullable |
| `planned_target` | integer | nullable |
| `planned_breakpoint` | integer | nullable |
| `actual_foot` | integer | |
| `actual_target` | integer | |
| `actual_breakpoint` | integer | |
| `actual_finish` | integer | |
| `notes` | text | nullable |
| `recorded_at` | timestamptz | |

All tables have RLS enabled with policy `auth.uid() = user_id` (or via session join for lineup_shots).

---

## Server Actions (`app/app/lineup/actions.js`)

All actions require an authenticated Supabase session.

| Action | Purpose |
|---|---|
| `getUserProfile()` | Fetch user_profiles row |
| `upsertUserProfile(data)` | Create or update profile |
| `getBalls()` | List ball catalog |
| `createBall(data)` | Add ball to catalog |
| `updateBallSurface(ballId, surface)` | Update surface + surface_changed_on |
| `createSession(data)` | Start session, returns session UUID |
| `addBallToSession(data)` | Link ball to session; triggers surface write-back |
| `saveShot(data)` | Persist a shot |
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
      Header             -- session meta, shot count pill
      Lane               -- SVG lane (drag to plan/record; reviewShots prop = read-only mode)
      Tabs               -- Plan / Record
      Readout chips      -- Foot . Target . Exp BP . [Finish in record]
      Action button      -- "Plan looks good" / "Save shot"
      Drawers
        history    -> ShotHistory (with edit/remove)
        sessions   -> SessionReview (list -> detail, read-only)
        menu       -> HamburgerMenu (balls, display tweaks, session actions)
```
