# Project Status & Local Dev Problem

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
- `proxy.js` (Next.js 16 auth middleware, named `proxy` not `middleware`) gates all `/app/*` routes
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
- **Cannot run locally**: Turbopack error prevents `npx next dev` from working (see problem section)

---

## LineUp App — Background

LineUp helps a tenpin bowler read a lane by tracking shots and making positional recommendations.

**Key domain concepts:**
- The lane has 39 boards (board 1 = right gutter, board 39 = left gutter)
- The oil pattern has a length (e.g. 42 ft); the "rule of 31" gives the expected breakpoint board (`patternLength - 31`)
- A `Line` represents one shot: foot position, ball start, target at the arrows, breakpoint (where the ball exits the oil and hooks), and finish position at the pins
- `boardsCrossed = (ballStart - breakpoint) + (finishPosition - breakpoint)` — the total hook swing amplitude
- The `LaneRead` class accumulates shots, computes a weighted lane breakpoint, builds a move table (all 39 target positions that route the ball to the pocket at board 17), and predicts which move table row the player should use next

**Bugs fixed during port:**
1. Breakpoint weighting used `line.target` in the distance formula where it should use `line.breakpoint`
2. `_calcBreakpoint` computed a weighted average of `line.target` values instead of `line.breakpoint` values
3. The anchor (a phantom prior line) was included in all calculations, corrupting the breakpoint and prediction with degenerate values (target=0, breakpoint=0)
4. With only 1 real shot, prediction interpolated between the real shot and the anchor (nonsensical); now uses the shot's `boardsCrossed` directly
5. `deltaBoardsCrossed === 0` fallback in prediction was wrong; now averages boardsCrossed of the two closest shots
6. `importSessionJSON` called `initSession` without importing it (original bug)
7. `ANCHOR_FINISH` formula recalibrated from `62 - 1.25x` to `49 - 0.9x` to better centre estimates across typical pattern lengths

---

## The Local Dev Problem

### Error

Running `npx next dev` from `C:\ajw\local-dev\next-platform-starter`:

```
▲ Next.js 16.2.6 (Turbopack)
- Local:        http://localhost:3000
✓ Ready in 563ms
Error: Turbopack build failed with 1 errors:
./app
Error: Next.js inferred your workspace root, but it may not be correct.
    We couldn't find the Next.js package (next/package.json) from the project directory: C:\ajw\local-dev\next-platform-starter\app
     To fix this, set turbopack.root in your Next.js config, or ensure the Next.js package is resolvable from this directory.
    Note: For security and performance reasons, files outside of the project directory will not be compiled.
    See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory for more information.
```

### What is happening

Next.js 16 uses Turbopack as the default bundler for `next dev`. Turbopack has a workspace root detection mechanism (inherited from its Rust/Cargo toolchain roots) that:

1. Walks the directory tree to infer where the "workspace root" is
2. From the workspace root, determines the "project directory" (the Next.js app within the workspace)
3. Restricts compilation to files within the project directory

In this case, Turbopack is incorrectly identifying the project directory as `next-platform-starter\app` (the Next.js App Router source folder) rather than `next-platform-starter` (the actual project root containing `package.json`, `node_modules`, `next.config.js`, etc.).

As a result:
- `next/package.json` is not findable from `app/` (it lives at `next-platform-starter/node_modules/next/package.json`)
- Files in `lib/lineup/` (the pure logic layer) are outside the detected project directory and cannot be compiled
- The dev server starts but immediately fails on first compile

### Why this project structure is relevant

The project has files at several levels relative to the Next.js `app/` directory:

```
next-platform-starter/
  next.config.js          ← project config
  package.json            ← dependencies (next, react, etc.)
  node_modules/           ← all packages including next itself
  lib/
    lineup/               ← pure logic (constants.js, models.js, state.js)
    supabase/             ← supabase client helpers
  components/
    lineup/               ← React UI components
  app/
    app/
      lineup/
        page.jsx          ← gated route (server component)
        lineup-app.jsx    ← client component
    layout.jsx
    page.jsx
    ...
```

The `lib/lineup/` files are imported by components inside `app/`. If Turbopack's project directory is `app/`, it will refuse to compile imports from `lib/` (outside the project directory boundary).

### Directory context

- `C:\ajw\local-dev\next-platform-starter` — the project (has `.git`, `package.json`, `node_modules`)
- `C:\ajw\local-dev` — parent directory; **no `.git`**, **no `package.json`**, no workspace markers of any kind
- Only two `package.json` files exist: one at the project root and one at `next-platform-starter\.next\dev\package.json` (a Turbopack dev-mode build artifact, NOT a real package)

The `.next` directory is the build output folder. The `.next\dev\package.json` is created by Turbopack itself during dev compilation and contains `{"type": "commonjs"}` — it is not a project file.

### What has been tried (none of these changed the error)

**1. `turbopack.root: process.cwd()`** in `next.config.js`
```js
turbopack: { root: process.cwd() }
```
No effect. The error message was identical.

**2. `turbopack.root: __dirname`** (via ESM imports)
```js
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nextConfig = { turbopack: { root: __dirname } }
```
No effect. The error message was identical.

**3. `turbopack.root: '../'`** (parent directory)
```js
turbopack: { root: '../' }
```
No effect. The error message was identical.

**4. `next dev --no-turbopack`** flag
```
error: unknown option '--no-turbopack'
```
This flag does not exist in Next.js 16.2.6.

**5. Deleting `.next` directory** before running dev
Removes the `.next\dev\package.json` artifact. No effect on the error.

**6. `next dev` without any flags or config** (baseline)
Same error as above — Turbopack runs by default in Next.js 16.

### Key observation

Despite three different `turbopack.root` values being set in `next.config.js`, the error message remained **completely identical** every time — same detected project directory (`next-platform-starter\app`), same wording. This strongly suggests that either:

- The `turbopack.root` config option is not being read at all in this version
- Or it is read but does not affect the workspace/project directory detection in Next.js 16.2.6 on Windows

The production build (`npx next build`) works correctly on the Linux CI/CD server. The problem is specific to **Turbopack dev mode on Windows**.

### Things not yet tried

- Setting `TURBOPACK_ROOT` or similar environment variables (unclear if these exist)
- Creating a `turbo.json` at the project root (Turbopack's own config format, separate from Next.js config)
- Using WSL2 (Windows Subsystem for Linux) to run the dev server — likely to work since the issue appears Windows-path-specific
- Checking the Next.js 16 changelog/issues for a known Windows Turbopack path bug
- Running `next dev` from inside the `app/` directory (probably won't work but untested)
- Using `npx next@15 dev` to force an older Next.js version that uses Webpack by default

### Node.js and package versions

- Node.js: unknown (not checked)
- Next.js local: 16.2.6 (confirmed via `npx next --version`)
- Next.js on server (Linux): 16.2.4
- `package.json` specifies `"next": "^16.0.8"`
- React: 19.2.6
- `reactCompiler: true` in `next.config.js` (uses `babel-plugin-react-compiler`)
