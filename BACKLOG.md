# LineUp — Feature Backlog

Potential enhancements discussed but not yet implemented. Ordered roughly by value-to-effort ratio.

---

## High Priority

### 1. Carry result per shot (strike / spare / split / open)
**Value:** High — the single biggest missing analytical dimension. Finish position tells you *where* the ball went, but not *what happened*.  
**Complexity:** Medium — requires a result picker in the save flow, a new `result` column in `lineup_shots`, and updated stats in SessionReview.  
**Implementation notes:**
- Add a 4-option result picker (Strike / Light hit / Split / Other) to the record flow, shown after setting finish
- Add `carry_result` column (enum: strike, light, split, open) to `lineup_shots`
- Update `saveShot` server action to persist it
- Add carry % to the SessionReview stats strip
- Over time: build a finish-board × carry-result heatmap (which boards strike vs. split)

---

### 2. Venue + oil pattern library
**Value:** High — without venue/pattern context, historical sessions are hard to interpret.  
**Complexity:** Medium — new `venues` and `patterns` tables; SetupScreen gets dropdown + quick-add.  
**Implementation notes:**
- New tables: `venues` (name, city, user_id), `patterns` (name, length, type, user_id; also a shared/public set of PBA/WTBA/Kegel patterns pre-loaded)
- SetupScreen: dropdown "Select venue" + "Add venue"; dropdown "Select pattern" + "Add pattern" + free-text fallback
- `lineup_sessions` gets nullable `venue_id` and `pattern_id` FKs
- SessionReview list can then group or filter by venue/pattern

---

### 3. Lane number tracking
**Value:** Medium-High — bowlers in competition move between pairs; lane-to-lane differences matter.  
**Complexity:** Low — simple integer columns, minor UI addition.  
**Implementation notes:**
- Add `lane_left` and `lane_right` (integer, nullable) to `lineup_sessions`
- Add a lane pair field to SetupScreen (e.g. "Lanes 11-12")
- Optionally: on the record shot screen, add a "which lane" toggle (L / R of pair)
- Add `lane` (nullable) to `lineup_shots` for per-shot lane tracking in tournaments

---

## Medium Priority

### 4. Session comparison / starting line lookup
**Value:** Medium-High — "last time on this pattern at this venue I started at 15/10" is directly actionable.  
**Complexity:** Medium — requires venue+pattern to be implemented first (item 2); then a summary query.  
**Implementation notes:**
- In SessionReview detail view, show a "Previous sessions on this pattern" section (same pattern_length or pattern_id)
- Surface the starting foot/target of the first shot each time
- Show finish trend (did the line drift inside/outside over the session?)

---

### 5. Equipment surface reminders
**Value:** Medium — `surface_changed_on` is already captured; surfacing this as a nudge is almost free.  
**Complexity:** Low — simple derived display in HamburgerMenu ball list.  
**Implementation notes:**
- Show days since last surface change on each ball in the menu ball list: `X days since resurface`
- Highlight in amber if > 30 games estimate (would need shot count from DB, or just time-based)
- Optionally show a banner in SetupScreen if the active ball's surface is old

---

### 6. Session notes and conditions
**Value:** Medium — contextual notes (fresh oil, broken down, temperature) aid retrospective analysis.  
**Complexity:** Low — text field + a few structured fields.  
**Implementation notes:**
- Add `oil_condition` (enum: fresh, 1-game, worn) and `notes` (text) to `lineup_sessions`
- Add these fields to SetupScreen (optional/collapsible section)
- Display in SessionReview detail header

---

### 7. Practice drill tracking
**Value:** Medium — different from competition: spare shooting, specific target drills.  
**Complexity:** Medium — needs a session type flag and possibly a different shot model.  
**Implementation notes:**
- Add `session_type` (enum: competition, practice, league) to `lineup_sessions`
- In practice mode: allow recording shots against a target spare (e.g. "7-pin") rather than always aiming at pocket
- Stats: conversion % by spare type

---

## Lower Priority / Future

### 8. Coach / sharing export
**Value:** Medium (for users with a coach) — export a session summary as PDF or sharable link.  
**Complexity:** High — requires either a PDF rendering solution or a server-side shareable session view.

### 9. Adjustment confidence tracking
**Value:** Low-Medium — log whether the bowler followed the suggestion or overrode it, and what happened. Over time this reveals whether the algorithm matches the user's game.  
**Complexity:** Medium — needs a "followed suggestion?" flag per shot and aggregation logic.

### 10. Carry % by finish board (heat map)
**Value:** High once carry result data exists (item 1) — shows which finish boards strike vs. split for this bowler.  
**Complexity:** Medium — needs carry result data and a visualisation component.

### 11. Team / pair analytics
**Value:** Medium for league/tournament use — see what teammates are doing on the same pair.  
**Complexity:** High — requires multi-user data sharing, access control beyond simple user_id RLS.

---

### 12. Full ball catalog entry (manufacturer, weight, cover stock)
**Value:** Medium — `balls` table already has `manufacturer`, `weight`, `cover_stock_type`, and `serial_number` columns; they're just nullable because the UI never captures them.  
**Complexity:** Low — extend the "New ball" form in SetupScreen with a few extra fields.  
**Implementation notes:**
- Add `manufacturer` (text), `weight` (numeric, e.g. 15.0), and `cover_stock_type` (solid/pearl/hybrid/urethane) to the new-ball form in SetupScreen
- `serial_number` optional (useful for insurance / multi-ball bags) — add as a collapsible "advanced" row
- `cover_stock_type` is most useful for lane-read analysis (pearl vs solid behaves differently on oil transitions) and should be surfaced in the ball list in HamburgerMenu
- Update `createBall` in `actions.js` to pass these fields (signature already accepts them; they're just never populated today)

---

## Technical Debt / Quality

- **Role-based access enforcement**: `user_app_access.role` is now a typed `app_role` enum (viewer / user / admin). Currently middleware admits any non-null row equally. Future work: enforce viewer = read-only in server actions and UI; gate admin-only features (e.g. bulk data management, pattern library curation) behind admin check. Schema and enum are already in place — this is purely application-layer enforcement.
- **Actual breakpoint input**: Currently breakpoint is always derived from foot+target. An "actual BP" adjustment (for balls that hook early) would improve `boardsCrossed` accuracy. Low priority until confirmed needed in testing.
- **Import flow + DB sync**: Importing a JSON session currently only restores in-memory state; it does not create DB rows. If import is used regularly, it should optionally persist to Supabase.
- **Error handling in server actions**: Currently all DB errors are silently swallowed in fire-and-forget calls. A lightweight error toast would improve observability.
