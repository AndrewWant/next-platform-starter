'use client';

/**
 * Lane — interactive SVG bowling lane.
 *
 * Drag interaction: pointer events on the SVG. On pointerdown the active zone
 * is determined from the Y position; subsequent pointermove events update the
 * value for that zone as the user drags left/right. A coloured crosshair
 * overlay shows the current drag position. Zones active per mode:
 *
 *   finish    — pin deck strip           — record only
 *   brk       — lane above arrow line    — plan + record
 *   target    — lane below arrow line    — plan + record
 *   foot      — approach                 — plan + record
 *
 * Props:
 *   session   { hand, patternLength, patternLabel, ballOffset, drift }
 *   plan      { foot, target, brk, derived: { ballRelease, slideFoot, setupFoot, ballStart } }
 *   result    { foot, target, brk, finish }
 *   mode      'plan' | 'record'
 *   on        { target(b), brk(b), foot(b), finish(b) }
 *   tweaks    { showPinNumbers, showPath, showApproachDots, markerContrast }
 */

import { useRef, useState, useCallback } from 'react';

// ─── Geometry ─────────────────────────────────────────────────────────────────

const W_LANE  = 390;
const H_LANE  = 660;
const BOARD_W = W_LANE / 39;           // ≈ 10px

const PIN_DECK_H    = 100;
const LANE_H_PX     = 380;             // lane surface height in SVG units
const FOUL_Y        = PIN_DECK_H + LANE_H_PX;   // 480
const FOUL_THICK    = 6;
const APPROACH_GAP  = 24;
const APPROACH_Y0   = FOUL_Y + FOUL_THICK + APPROACH_GAP;
const APPROACH_H    = H_LANE - APPROACH_Y0;

const ARROW_BOARDS        = [5, 10, 15, 20, 25, 30, 35];
const LANE_DOT_BOARDS     = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37];
const APPROACH_DOT_BOARDS = [5, 10, 15, 20, 25, 30, 35];

const ARROW_BOTTOM_Y = FOUL_Y - LANE_H_PX * 0.20;
const ARROW_TOP_Y    = FOUL_Y - LANE_H_PX * 0.25;
const ARROW_W        = BOARD_W * 1.05;
const ARROW_LINE_Y   = (ARROW_TOP_Y + ARROW_BOTTOM_Y) / 2;

const LANE_DOT_Y     = FOUL_Y - LANE_H_PX * (8 / 60);
const APPROACH_DOT_Y = APPROACH_Y0 + APPROACH_H * 0.42;

const PINS = [
  { n: 1,  pb: 20,    row: 0 },
  { n: 2,  pb: 14.35, row: 1 }, { n: 3,  pb: 25.65, row: 1 },
  { n: 4,  pb: 8.7,   row: 2 }, { n: 5,  pb: 20,    row: 2 }, { n: 6,  pb: 31.3,  row: 2 },
  { n: 7,  pb: 3,     row: 3 }, { n: 8,  pb: 14.35, row: 3 }, { n: 9,  pb: 25.65, row: 3 }, { n: 10, pb: 37, row: 3 },
];
const PIN_R     = 11;
const PIN_ROW_Y = [PIN_DECK_H - 16, PIN_DECK_H - 40, PIN_DECK_H - 64, PIN_DECK_H - 88];

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  bg:             '#14110d',
  pinDeckBack:    '#3a2c1e',
  laneSurface:    '#ecca99',
  laneOil:        '#d2ad75',
  laneMarker:     '#c69859',
  laneMarkerOil:  '#a8804f',
  approachSurf:   '#d2ad75',
  approachMarker: '#a47d4f',
  arrow:          '#3a2516',
  dot:            '#3a2516',
  foulLine:       '#b53b34',
  gutter:         '#1f160f',
  pinBody:        '#f5efde',
  pinCollar:      '#b53b34',
  patternLine:    '#5d8da8',
  target:         '#ee7a2e',
  brk:            '#3a86d4',
  stance:         '#3fb27a',
  finish:         '#ffd166',
};

const ZONE_COLOR = {
  target: C.target,
  brk:    C.brk,
  foot:   C.stance,
  finish: C.finish,
};

// ─── Coordinate helpers ───────────────────────────────────────────────────────

const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1  = n => Math.round(n * 10) / 10;

// Physical board → SVG x (physical board 1 always on the LEFT of the SVG)
const physX = pb => (pb - 0.5) * BOARD_W;

// Bowler board ↔ physical board
const bowlerToPhys = (b, hand) => hand === 'L' ? b : 40 - b;
const physToBowler = (pb, hand) => hand === 'L' ? pb : 40 - pb;

// Bowler board → SVG x
const bowlerX = (b, hand) => physX(bowlerToPhys(b, hand));

// SVG x → bowler board (1..39)
const xToBowler = (x, hand) => {
  const pb = clamp(Math.floor(x / BOARD_W) + 1, 1, 39);
  return physToBowler(pb, hand);
};

// Pattern end Y from pattern length in feet
const patternY = len => FOUL_Y - LANE_H_PX * (len / 60);

// Export helpers for use in lineup-app
export { bowlerToPhys, physToBowler, round1, clamp, ARROW_BOARDS, FOUL_Y, PIN_ROW_Y, APPROACH_DOT_Y };

// ─── Sub-components ───────────────────────────────────────────────────────────

function PinGlyph({ cx, cy, showNumber, label }) {
  return (
    <g>
      <ellipse cx={cx + 0.6} cy={cy + 1.5} rx={PIN_R * 0.9} ry={PIN_R * 0.55} fill="rgba(0,0,0,0.45)" />
      <circle cx={cx} cy={cy} r={PIN_R} fill={C.pinBody} stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} />
      <circle cx={cx} cy={cy} r={PIN_R * 0.62} fill="none" stroke={C.pinCollar} strokeWidth={1.6} opacity={0.85} />
      <ellipse cx={cx - PIN_R * 0.3} cy={cy - PIN_R * 0.4} rx={PIN_R * 0.35} ry={PIN_R * 0.18} fill="rgba(255,255,255,0.7)" />
      {showNumber && (
        <text x={cx} y={cy + 3.5} textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace" fontSize={9} fontWeight={600} fill="#3a2516">
          {label}
        </text>
      )}
    </g>
  );
}

function LaneBoardColumn({ pb, oilTop, markerContrast }) {
  const x        = (pb - 1) * BOARD_W;
  const isMarker = ARROW_BOARDS.includes(pb);
  const dryFill  = isMarker ? C.laneMarker    : C.laneSurface;
  const oilFill  = isMarker ? C.laneMarkerOil : C.laneOil;
  return (
    <g>
      <rect x={x} y={PIN_DECK_H} width={BOARD_W} height={oilTop - PIN_DECK_H} fill={dryFill} />
      <rect x={x} y={oilTop}     width={BOARD_W} height={FOUL_Y - oilTop}     fill={oilFill} />
      <rect x={x + BOARD_W * 0.18} y={PIN_DECK_H} width={0.4} height={LANE_H_PX} fill="rgba(0,0,0,0.06)" />
      <rect x={x + BOARD_W * 0.62} y={PIN_DECK_H} width={0.3} height={LANE_H_PX} fill="rgba(255,255,255,0.05)" />
      <rect x={x + BOARD_W - 0.4}  y={PIN_DECK_H} width={0.4} height={LANE_H_PX} fill="rgba(0,0,0,0.18)" />
      {isMarker && markerContrast > 0 && (
        <rect x={x} y={PIN_DECK_H} width={BOARD_W} height={LANE_H_PX}
              fill="#000" opacity={markerContrast * 0.12} />
      )}
    </g>
  );
}

// ─── Main Lane component ──────────────────────────────────────────────────────

export default function Lane({ session, plan, result, mode, on, tweaks, reviewShots }) {
  const svgRef        = useRef(null);
  const [activeZone, setActiveZone] = useState(null);
  const hand    = session.hand;
  const oilTop  = patternY(session.patternLength);

  // Review mode: reviewShots provided without plan/result
  const isReview = reviewShots != null && plan == null;

  // Active values by mode (only when not in review mode)
  const target  = isReview ? null : (mode === 'plan' ? plan.target : result.target);
  const brk     = isReview ? null : (mode === 'plan' ? plan.brk    : result.brk);
  const stanceB = isReview ? null : (mode === 'plan' ? plan.foot : result.foot);
  const finish  = isReview ? null : result.finish;

  // Ball release at foul line (for the Bézier path start)
  const ballRelease = isReview ? null : plan.derived.ballRelease;

  // ── Pointer-drag helpers ─────────────────────────────────────────────────

  const svgXFromPointer = useCallback((clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const frac = (clientX - rect.left) / rect.width;
    return frac * W_LANE;
  }, []);

  const svgYFromPointer = useCallback((clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const frac = (clientY - rect.top) / rect.height;
    return frac * H_LANE;
  }, []);

  const zoneFromY = useCallback((svgY) => {
    if (svgY < PIN_DECK_H)   return mode === 'record' ? 'finish' : null;
    if (svgY < ARROW_LINE_Y) return null;    // brk zone: display only, never interactive
    if (svgY < FOUL_Y)       return 'target';
    if (svgY >= APPROACH_Y0) return 'foot';
    return null;
  }, [mode]);

  const fireZone = useCallback((zone, svgX) => {
    if (!zone || svgX == null) return;
    const b = xToBowler(svgX, hand);
    if (zone === 'target') on.target(b);
    else if (zone === 'brk')    on.brk(b);
    else if (zone === 'foot')   on.foot(b);
    else if (zone === 'finish') on.finish(b);
  }, [hand, on]);

  const handlePointerDown = useCallback((e) => {
    if (isReview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const svgX = svgXFromPointer(e.clientX);
    const svgY = svgYFromPointer(e.clientY);
    const zone = zoneFromY(svgY);
    if (!zone) return;
    setActiveZone(zone);
    fireZone(zone, svgX);
  }, [isReview, svgXFromPointer, svgYFromPointer, zoneFromY, fireZone]);

  const handlePointerMove = useCallback((e) => {
    if (!activeZone) return;
    const svgX = svgXFromPointer(e.clientX);
    fireZone(activeZone, svgX);
  }, [activeZone, svgXFromPointer, fireZone]);

  const handlePointerUp = useCallback(() => {
    setActiveZone(null);
  }, []);

  // ── Crosshair zone Y extents ──────────────────────────────────────────────
  const ZONE_Y = {
    finish: { y1: 2,           y2: PIN_DECK_H - 2 },
    brk:    { y1: PIN_DECK_H,  y2: ARROW_LINE_Y   },
    target: { y1: ARROW_LINE_Y, y2: FOUL_Y         },
    foot:   { y1: APPROACH_Y0,  y2: H_LANE - 4     },
  };

  // Crosshair X position: use the current value for the active zone
  const crosshairBoard = activeZone === 'target' ? target
    : activeZone === 'brk'    ? brk
    : activeZone === 'foot'   ? stanceB
    : activeZone === 'finish' ? (finish ?? 20)
    : null;
  const crosshairX = crosshairBoard != null ? bowlerX(crosshairBoard, hand) : null;

  // ── Shot path Bézier helper ───────────────────────────────────────────────
  // release → target (arrows) → breakpoint (oil end) → finish (pin deck)
  const makeShotPath = (releaseBd, tgt, brkBd, finBd) => {
    const sx = bowlerX(clamp(releaseBd, 1, 39), hand);
    const tx = bowlerX(clamp(tgt,       1, 39), hand);
    const bx = bowlerX(clamp(brkBd,     1, 39), hand);
    const fx = bowlerX(clamp(finBd,     1, 39), hand);
    const ddx = bx - tx;
    const ddy = oilTop - ARROW_LINE_Y;
    const approachLen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const hookLen     = Math.sqrt((fx - bx) ** 2 + (PIN_ROW_Y[0] - oilTop) ** 2);
    const k           = (hookLen * 0.55) / approachLen;
    return `M ${sx} ${FOUL_Y} L ${tx} ${ARROW_LINE_Y} L ${bx} ${oilTop} Q ${bx + ddx * k} ${oilTop + ddy * k} ${fx} ${PIN_ROW_Y[0]}`;
  };

  // ── Active ball path (plan/record mode) ───────────────────────────────────
  const ballPath = (() => {
    if (isReview || !tweaks.showPath) return null;
    const finishBoard = mode === 'record' && finish != null ? finish : 17;
    const releaseBd = (mode === 'plan') ? ballRelease : (result.foot + (session.drift ?? 0) - session.ballOffset);
    return makeShotPath(releaseBd, target, brk, finishBoard);
  })();

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W_LANE} ${H_LANE}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <linearGradient id="lu-pinDeckGrad" x1="0" y1="0" x2="0" y2={PIN_DECK_H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c2014" />
          <stop offset="1" stopColor="#42321f" />
        </linearGradient>
        <linearGradient id="lu-approachGrad" x1="0" y1={APPROACH_Y0} x2="0" y2={H_LANE} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c9a26c" />
          <stop offset="1" stopColor="#b78a52" />
        </linearGradient>
        <linearGradient id="lu-foulGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.4" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lu-oilGloss" x1="0" y1={oilTop} x2="0" y2={FOUL_Y} gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="rgba(180,200,230,0.18)" />
          <stop offset="0.55" stopColor="rgba(180,200,230,0.06)" />
          <stop offset="1"    stopColor="rgba(180,200,230,0)"    />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={W_LANE} height={H_LANE} fill={C.bg} />

      {/* ── PIN DECK ── */}
      <rect x="0" y="0" width={W_LANE} height={PIN_DECK_H} fill="url(#lu-pinDeckGrad)" />
      {Array.from({ length: 39 }, (_, i) => i + 1).map(pb => (
        <rect key={`pds-${pb}`}
              x={(pb - 1) * BOARD_W + BOARD_W - 0.4} y={4}
              width={0.4} height={PIN_DECK_H - 8}
              fill="rgba(255,255,255,0.06)" />
      ))}
      {/* Review mode: finish tick marks for each historical shot */}
      {isReview && reviewShots?.map((s, i) => {
        const atPocket = Math.abs(s.actual_finish - 17) <= 1;
        const color = atPocket ? C.stance : C.target;
        const px = (bowlerToPhys(s.actual_finish, hand) - 1) * BOARD_W;
        return (
          <g key={`rf-${i}`}>
            <rect x={px} y={PIN_DECK_H - 18} width={BOARD_W} height={14}
                  fill={color} opacity={atPocket ? 0.55 : 0.3} rx={2} />
          </g>
        );
      })}
      {!isReview && finish != null && (
        <g>
          <rect x={(bowlerToPhys(finish, hand) - 1) * BOARD_W} y={2}
                width={BOARD_W} height={PIN_DECK_H - 4}
                fill={C.finish} opacity={0.55} />
          <rect x={(bowlerToPhys(finish, hand) - 1) * BOARD_W} y={2}
                width={BOARD_W} height={PIN_DECK_H - 4}
                fill="none" stroke={C.finish} strokeWidth={1.5} />
          <text x={bowlerX(finish, hand)} y={PIN_DECK_H - 4}
                textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                fontSize={10} fontWeight={700} fill="#2a1e0a">
            {finish}
          </text>
        </g>
      )}
      {PINS.map(p => (
        <PinGlyph key={p.n} cx={physX(p.pb)} cy={PIN_ROW_Y[p.row]}
                  label={p.n} showNumber={tweaks.showPinNumbers} />
      ))}
      <rect x="0" y={PIN_DECK_H - 2} width={W_LANE} height={3} fill="rgba(0,0,0,0.55)" />

      {/* ── LANE BOARDS ── */}
      {Array.from({ length: 39 }, (_, i) => i + 1).map(pb => (
        <LaneBoardColumn key={`lb-${pb}`} pb={pb} oilTop={oilTop}
                         markerContrast={tweaks.markerContrast} />
      ))}
      <rect x={1} y={oilTop} width={W_LANE - 2} height={FOUL_Y - oilTop} fill="url(#lu-oilGloss)" />
      <rect x={0}             y={PIN_DECK_H} width={1.4}   height={LANE_H_PX} fill={C.gutter} opacity={0.75} />
      <rect x={W_LANE - 1.4} y={PIN_DECK_H} width={1.4}   height={LANE_H_PX} fill={C.gutter} opacity={0.75} />

      {/* ── END-OF-PATTERN LINE ── */}
      <line x1={4} y1={oilTop} x2={W_LANE - 4} y2={oilTop}
            stroke={C.patternLine} strokeWidth={1.1} strokeDasharray="6 4" opacity={0.85} />
      <g>
        <rect x={W_LANE - 90} y={oilTop - 11} width={84} height={18}
              rx={9} fill="rgba(20,17,13,0.78)" stroke={C.patternLine} strokeWidth={0.7} />
        <text x={W_LANE - 48} y={oilTop + 2}
              textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
              fontSize={10} fontWeight={600} fill={C.patternLine} letterSpacing="0.08em">
          {(session.patternLabel || `${session.patternLength} FT`).toUpperCase()}
        </text>
      </g>

      {/* Lane locator dots */}
      {LANE_DOT_BOARDS.map(pb => (
        <circle key={`ld-${pb}`} cx={physX(pb)} cy={LANE_DOT_Y} r={2.4} fill={C.dot} opacity={0.92} />
      ))}

      {/* Arrows */}
      {ARROW_BOARDS.map(pb => {
        const cx       = physX(pb);
        const half     = ARROW_W / 2;
        const isAimed  = bowlerToPhys(target, hand) === pb;
        return (
          <g key={`ar-${pb}`}>
            <polygon points={`${cx},${ARROW_TOP_Y} ${cx - half},${ARROW_BOTTOM_Y} ${cx + half},${ARROW_BOTTOM_Y}`}
                     fill={C.arrow} />
            {isAimed && (
              <polygon
                points={`${cx},${ARROW_TOP_Y - 1.4} ${cx - half - 1},${ARROW_BOTTOM_Y + 0.6} ${cx + half + 1},${ARROW_BOTTOM_Y + 0.6}`}
                fill="none" stroke={C.target} strokeWidth={2.2} />
            )}
          </g>
        );
      })}

      {/* TARGET marker (plan/record only) */}
      {!isReview && (
        <g>
          <circle cx={bowlerX(target, hand)} cy={ARROW_LINE_Y}
                  r={8.5} fill="none" stroke={C.target} strokeWidth={2.4} />
          <circle cx={bowlerX(target, hand)} cy={ARROW_LINE_Y} r={2.6} fill={C.target} />
          <text x={bowlerX(target, hand)} y={ARROW_LINE_Y + 22}
                textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                fontSize={10} fontWeight={700} fill={C.target}>
            {target}
          </text>
        </g>
      )}

      {/* BREAKPOINT marker (plan/record only) */}
      {!isReview && (
        <g>
          <line x1={bowlerX(brk, hand)} y1={oilTop - 7}
                x2={bowlerX(brk, hand)} y2={oilTop + 7}
                stroke={C.brk} strokeWidth={2.5} />
          <circle cx={bowlerX(brk, hand)} cy={oilTop}
                  r={8.5} fill="none" stroke={C.brk} strokeWidth={2.4} />
          <circle cx={bowlerX(brk, hand)} cy={oilTop} r={2.6} fill={C.brk} />
          <text x={bowlerX(brk, hand)} y={oilTop - 14}
                textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                fontSize={10} fontWeight={700} fill={C.brk}>
            {brk}
          </text>
        </g>
      )}

      {/* Review mode: overlaid historical shot paths */}
      {isReview && reviewShots?.map((s, i) => {
        const isRecent  = i === reviewShots.length - 1;
        const atPocket  = Math.abs(s.actual_finish - 17) <= 1;
        const color     = atPocket ? C.stance : C.target;
        const opacity   = isRecent ? 0.7 : 0.3;
        const releaseBd = s.actual_foot + (session.drift ?? 0) - (session.ballOffset ?? 5);
        const d = makeShotPath(releaseBd, s.actual_target, s.actual_breakpoint, s.actual_finish);
        return (
          <g key={`rp-${i}`} pointerEvents="none">
            <path d={d} fill="none" stroke={color} strokeOpacity={opacity}
                  strokeWidth={isRecent ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}

      {/* Active ball path (plan/record only) */}
      {ballPath && (
        <g>
          <path d={ballPath} fill="none" stroke="rgba(0,0,0,0.65)"
                strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          <path d={ballPath} fill="none" stroke="rgba(255,255,255,0.9)"
                strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {/* FOUL LINE */}
      <rect x="0" y={FOUL_Y - 3} width={W_LANE} height={3} fill="url(#lu-foulGlow)" opacity={0.7} />
      <rect x="0" y={FOUL_Y}     width={W_LANE} height={FOUL_THICK} fill={C.foulLine} />
      <rect x="0" y={FOUL_Y + FOUL_THICK} width={W_LANE} height={1.5} fill="rgba(0,0,0,0.4)" />

      {/* ── APPROACH ── */}
      <rect x="0" y={APPROACH_Y0} width={W_LANE} height={APPROACH_H} fill="url(#lu-approachGrad)" />
      {Array.from({ length: 39 }, (_, i) => i + 1).map(pb => {
        const isMarker = ARROW_BOARDS.includes(pb);
        const x = (pb - 1) * BOARD_W;
        return (
          <g key={`ab-${pb}`}>
            <rect x={x} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                  fill={isMarker ? C.approachMarker : C.approachSurf} />
            <rect x={x + BOARD_W - 0.4} y={APPROACH_Y0} width={0.4} height={APPROACH_H}
                  fill="rgba(0,0,0,0.18)" />
            {isMarker && tweaks.markerContrast > 0 && (
              <rect x={x} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                    fill="#000" opacity={tweaks.markerContrast * 0.12} />
            )}
          </g>
        );
      })}
      <rect x="0" y={APPROACH_Y0}    width={W_LANE} height={2}   fill="rgba(0,0,0,0.4)" />
      <rect x="0" y={H_LANE - 2}     width={W_LANE} height={2}   fill="rgba(0,0,0,0.4)" />

      {tweaks.showApproachDots && APPROACH_DOT_BOARDS.map(pb => (
        <circle key={`ad-${pb}`} cx={physX(pb)} cy={APPROACH_DOT_Y} r={2.2} fill={C.dot} opacity={0.9} />
      ))}

      {/* STANCE marker (plan/record only) */}
      {!isReview && (() => {
        const isPlan = mode === 'plan';
        const x = bowlerX(stanceB, hand);
        return (
          <g opacity={isPlan ? 0.85 : 1}>
            <rect x={x - BOARD_W * 1.1} y={APPROACH_DOT_Y + 12}
                  width={BOARD_W * 2.2} height={22} rx={5}
                  fill={isPlan ? 'none' : C.stance}
                  stroke={C.stance} strokeWidth={isPlan ? 2.2 : 0}
                  strokeDasharray={isPlan ? '5 3' : '0'} />
            <text x={x} y={APPROACH_DOT_Y + 27}
                  textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                  fontSize={11} fontWeight={700}
                  fill={isPlan ? C.stance : '#0e2418'}>
              {stanceB}
            </text>
          </g>
        );
      })()}

      {/* Hand label */}
      <g opacity={0.55}>
        <text x={hand === 'R' ? W_LANE - 10 : 10} y={PIN_DECK_H + 14}
              textAnchor={hand === 'R' ? 'end' : 'start'}
              fontFamily="'JetBrains Mono', monospace"
              fontSize={9} fontWeight={600} fill="rgba(58,37,22,0.8)">
          {hand === 'R' ? 'R-HAND ›' : '‹ L-HAND'}
        </text>
        <text x={hand === 'R' ? W_LANE - 4 : 4} y={FOUL_Y - 4}
              textAnchor={hand === 'R' ? 'end' : 'start'}
              fontFamily="'JetBrains Mono', monospace"
              fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.55)">1</text>
        <text x={hand === 'R' ? 4 : W_LANE - 4} y={FOUL_Y - 4}
              textAnchor={hand === 'R' ? 'start' : 'end'}
              fontFamily="'JetBrains Mono', monospace"
              fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.55)">39</text>
      </g>

      {/* ── CROSSHAIR OVERLAY (rendered last, above everything) ── */}
      {activeZone && crosshairX != null && (() => {
        const { y1, y2 } = ZONE_Y[activeZone];
        const color = ZONE_COLOR[activeZone];
        const labelY = activeZone === 'brk' ? y1 + 14 : y2 - 6;
        return (
          <g pointerEvents="none">
            {/* shadow line for contrast against any lane surface */}
            <line x1={crosshairX} y1={y1} x2={crosshairX} y2={y2}
                  stroke="rgba(0,0,0,0.55)" strokeWidth={5} />
            {/* coloured crosshair line */}
            <line x1={crosshairX} y1={y1} x2={crosshairX} y2={y2}
                  stroke={color} strokeWidth={2.5} opacity={1} strokeDasharray="7 4" />
            {/* pill label */}
            <rect x={crosshairX - 14} y={labelY - 11} width={28} height={18} rx={9}
                  fill="rgba(0,0,0,0.65)" />
            <rect x={crosshairX - 13} y={labelY - 10} width={26} height={16} rx={8}
                  fill={color} opacity={0.95} />
            <text x={crosshairX} y={labelY + 1.5}
                  textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                  fontSize={10} fontWeight={700} fill="#fff">
              {crosshairBoard}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
