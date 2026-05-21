'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

// ─── Geometry ─────────────────────────────────────────────────────────────────

const BOARD_W      = 10;
const TOTAL_BOARDS = 50;
const LANE_BOARDS  = 39;
const EXT_BOARDS   = TOTAL_BOARDS - LANE_BOARDS; // 11

const W_LANE  = TOTAL_BOARDS * BOARD_W;  // 500
const H_LANE  = 660;

const PIN_DECK_H   = 100;
const LANE_H_PX    = 380;
const FOUL_Y       = PIN_DECK_H + LANE_H_PX;   // 480
const FOUL_THICK   = 6;
const APPROACH_GAP = 24;
const APPROACH_Y0  = FOUL_Y + FOUL_THICK + APPROACH_GAP;
const APPROACH_H   = H_LANE - APPROACH_Y0;
const LANE_W       = LANE_BOARDS * BOARD_W;     // 390

const ARROW_BOARDS        = [5, 10, 15, 20, 25, 30, 35];
const LANE_DOT_BOARDS     = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37];
const APPROACH_DOT_BOARDS = [5, 10, 15, 20, 25, 30, 35];

const ARROW_BOTTOM_Y = FOUL_Y - LANE_H_PX * 0.20;
const ARROW_TOP_Y    = FOUL_Y - LANE_H_PX * 0.25;
const ARROW_W        = BOARD_W * 1.05;
const ARROW_LINE_Y   = (ARROW_TOP_Y + ARROW_BOTTOM_Y) / 2;

const LANE_DOT_Y     = FOUL_Y - LANE_H_PX * (8 / 60);
const APPROACH_DOT_Y = APPROACH_Y0 + APPROACH_H * 0.42;
const APPROACH_MID_Y = APPROACH_Y0 + APPROACH_H * 0.38;
const SLIDE_MARKER_Y = APPROACH_Y0 + APPROACH_H * 0.19;

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
  extGutter:      '#888880',
  extWall:        '#2a1a0e',
};

const ZONE_COLOR = {
  target: C.target, brk: C.brk,
  foot_start: C.stance, foot_slide: C.stance, finish: C.finish,
};

// ─── Coordinate helpers ───────────────────────────────────────────────────────

const clamp        = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1       = n => Math.round(n * 10) / 10;
const laneOffsetX  = (hand) => hand === 'R' ? EXT_BOARDS * BOARD_W : 0;
const physXInLane  = pb => (pb - 0.5) * BOARD_W;
const physX        = (pb, offsetX) => physXInLane(pb) + offsetX;
const bowlerToPhys = (b, hand) => hand === 'L' ? b : 40 - b;
const physToBowler = (pb, hand) => hand === 'L' ? pb : 40 - pb;

const bowlerX = (b, hand, offsetX) => {
  if (b <= LANE_BOARDS) return physX(bowlerToPhys(b, hand), offsetX);
  const ext = b - LANE_BOARDS;
  return hand === 'R'
    ? offsetX - (ext - 0.5) * BOARD_W
    : offsetX + LANE_W + (ext - 0.5) * BOARD_W;
};

const xToBowler = (svgX, hand, offsetX) => {
  if (hand === 'R') {
    if (svgX >= offsetX) {
      return physToBowler(clamp(Math.floor((svgX - offsetX) / BOARD_W) + 1, 1, LANE_BOARDS), hand);
    }
    return LANE_BOARDS + clamp(Math.ceil((offsetX - svgX) / BOARD_W), 1, EXT_BOARDS);
  } else {
    if (svgX <= offsetX + LANE_W) {
      return physToBowler(clamp(Math.floor(svgX / BOARD_W) + 1, 1, LANE_BOARDS), hand);
    }
    return LANE_BOARDS + clamp(Math.ceil((svgX - LANE_W) / BOARD_W), 1, EXT_BOARDS);
  }
};

const patternY = len => FOUL_Y - LANE_H_PX * (len / 60);

export { bowlerToPhys, physToBowler, round1, clamp, ARROW_BOARDS, FOUL_Y, PIN_ROW_Y, APPROACH_DOT_Y };

// ─── Sub-components ───────────────────────────────────────────────────────────

function MarkerPill({ cx, cy, label, color }) {
  return (
    <g pointerEvents="none">
      <rect x={cx - 19} y={cy - 13} width={38} height={26} rx={13} fill="rgba(0,0,0,0.72)" />
      <rect x={cx - 18} y={cy - 12} width={36} height={24} rx={12} fill={color} opacity={0.95} />
      <text x={cx} y={cy + 7} textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace" fontSize={20} fontWeight={700} fill="#fff">
        {label}
      </text>
    </g>
  );
}

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

function LaneBoardColumn({ pb, oilTop, markerContrast, offsetX }) {
  const x       = (pb - 1) * BOARD_W + offsetX;
  const isMark  = ARROW_BOARDS.includes(pb);
  return (
    <g>
      <rect x={x} y={PIN_DECK_H} width={BOARD_W} height={oilTop - PIN_DECK_H} fill={isMark ? C.laneMarker    : C.laneSurface} />
      <rect x={x} y={oilTop}     width={BOARD_W} height={FOUL_Y - oilTop}     fill={isMark ? C.laneMarkerOil : C.laneOil} />
      <rect x={x + BOARD_W * 0.18} y={PIN_DECK_H} width={0.4} height={LANE_H_PX} fill="rgba(0,0,0,0.06)" />
      <rect x={x + BOARD_W * 0.62} y={PIN_DECK_H} width={0.3} height={LANE_H_PX} fill="rgba(255,255,255,0.05)" />
      <rect x={x + BOARD_W - 0.4}  y={PIN_DECK_H} width={0.4} height={LANE_H_PX} fill="rgba(0,0,0,0.18)" />
      {isMark && markerContrast > 0 && (
        <rect x={x} y={PIN_DECK_H} width={BOARD_W} height={LANE_H_PX} fill="#000" opacity={markerContrast * 0.12} />
      )}
    </g>
  );
}

function BoardLoupe({ cx, cy, board, color }) {
  const BW = BOARD_W * 2;
  const R  = 50;
  const boards = [-2, -1, 0, 1, 2].map(d => board + d);
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id="lu-loupe-clip">
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="#1c0f04" />
      <g clipPath="url(#lu-loupe-clip)">
        {boards.map((b, i) => {
          const bx = cx - BW * 2.5 + i * BW;
          const isCenter = i === 2;
          const fs = isCenter ? 24 : Math.abs(i - 2) === 1 ? 15 : 12;
          return (
            <g key={b}>
              <rect x={bx} y={cy - R} width={BW} height={R * 2}
                    fill={isCenter ? color : (i % 2 === 0 ? '#2e1a08' : '#1c0f04')}
                    opacity={isCenter ? 0.85 : 1} />
              <text x={bx + BW / 2} y={cy + fs * 0.4} textAnchor="middle"
                    fontFamily="'JetBrains Mono', monospace" fontSize={fs} fontWeight={700}
                    fill={b >= 1 && b <= 50 ? (isCenter ? '#fff' : 'rgba(255,255,255,0.45)') : 'none'}>
                {b >= 1 && b <= 50 ? b : ''}
              </text>
            </g>
          );
        })}
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R}
              stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} />
      </g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={2.5} />
      <polygon points={`${cx - 8},${cy + R - 1} ${cx + 8},${cy + R - 1} ${cx},${cy + R + 12}`}
               fill="#1c0f04" />
      <polyline points={`${cx - 8},${cy + R - 1} ${cx},${cy + R + 12} ${cx + 8},${cy + R - 1}`}
                fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Lane({ session, plan, result, mode, on, tweaks, reviewShots, expansionFoot = 0 }) {
  const svgRef  = useRef(null);
  const [activeZone, setActiveZone] = useState(null);
  const [loupeSvgY,  setLoupeSvgY]  = useState(null);
  const hand    = session.hand;
  const oilTop  = patternY(session.patternLength);
  const offsetX = laneOffsetX(hand);

  // ── viewBox animation ─────────────────────────────────────────────────────
  // Collapsed: show only 39 boards (lane fills full element width).
  // Expanded:  show all 50 boards (slight zoom-out reveals extension).
  // The viewBox is animated via RAF so both lane and approach expand together.

  const [vbState, setVbState] = useState(() => {
    const ext = Math.min(Math.max(0, expansionFoot - LANE_BOARDS), EXT_BOARDS);
    return {
      x: hand === 'R' ? laneOffsetX(hand) - ext * BOARD_W : 0,
      w: LANE_W + ext * BOARD_W,
    };
  });
  const vbRef      = useRef(vbState);   // tracks current animated value
  const animRafRef = useRef(null);

  useEffect(() => {
    const ext     = Math.min(Math.max(0, expansionFoot - LANE_BOARDS), EXT_BOARDS);
    const targetX = hand === 'R' ? laneOffsetX(hand) - ext * BOARD_W : 0;
    const targetW = LANE_W + ext * BOARD_W;
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    const startX = vbRef.current.x;
    const startW = vbRef.current.w;
    if (Math.abs(startX - targetX) < 0.5 && Math.abs(startW - targetW) < 0.5) return;
    const t0 = performance.now();
    const DURATION = 180;
    const step = (now) => {
      const t    = Math.min((now - t0) / DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const cur  = { x: startX + (targetX - startX) * ease, w: startW + (targetW - startW) * ease };
      vbRef.current = cur;
      setVbState({ ...cur });
      if (t < 1) animRafRef.current = requestAnimationFrame(step);
      else        animRafRef.current = null;
    };
    animRafRef.current = requestAnimationFrame(step);
    return () => { if (animRafRef.current) { cancelAnimationFrame(animRafRef.current); animRafRef.current = null; } };
  }, [expansionFoot, hand]);

  useEffect(() => () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current); }, []);

  // ── Pointer helpers ──────────────────────────────────────────────────────
  // Map CSS pixels → SVG coordinates using the CURRENT animated viewBox.

  const svgXFromPointer = useCallback((clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return vbRef.current.x + ((clientX - rect.left) / rect.width) * vbRef.current.w;
  }, []);

  const svgYFromPointer = useCallback((clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return ((clientY - rect.top) / rect.height) * H_LANE;
  }, []);

  const isReview    = reviewShots != null && plan == null;
  const target      = isReview ? null : (mode === 'plan' ? plan.target          : result.target);
  const brk         = isReview ? null : (mode === 'plan' ? plan.brk             : result.brk);
  const stanceB     = isReview ? null : (mode === 'plan' ? plan.foot            : result.foot);
  const slideB      = isReview ? null : (mode === 'plan' ? plan.derived.slideFoot : result.slide);
  const finish      = isReview ? null : result.finish;
  const ballRelease = isReview ? null : plan?.derived?.ballRelease;

  const zoneFromY = useCallback((svgY) => {
    if (svgY < PIN_DECK_H)     return mode === 'record' ? 'finish' : null;
    if (svgY < ARROW_LINE_Y)   return null;
    if (svgY < FOUL_Y)         return 'target';
    if (svgY < APPROACH_MID_Y) return mode === 'record' ? 'foot_slide' : null;
    return 'foot_start';
  }, [mode]);

  const fireZone = useCallback((zone, svgX) => {
    if (!zone || svgX == null) return;
    const b = xToBowler(svgX, hand, offsetX);
    if      (zone === 'target')     on.target(b);
    else if (zone === 'brk')        on.brk(b);
    else if (zone === 'foot_start') on.foot_start(b);
    else if (zone === 'foot_slide') on.foot_slide?.(b);
    else if (zone === 'finish')     on.finish(b);
  }, [hand, offsetX, on]);

  const handlePointerDown = useCallback((e) => {
    if (isReview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const svgX = svgXFromPointer(e.clientX);
    const svgY = svgYFromPointer(e.clientY);
    const zone = zoneFromY(svgY);
    if (!zone) return;
    setLoupeSvgY(svgY);
    setActiveZone(zone);
    fireZone(zone, svgX);
  }, [isReview, svgXFromPointer, svgYFromPointer, zoneFromY, fireZone]);

  const handlePointerMove = useCallback((e) => {
    if (!activeZone) return;
    setLoupeSvgY(svgYFromPointer(e.clientY));
    fireZone(activeZone, svgXFromPointer(e.clientX));
  }, [activeZone, svgXFromPointer, svgYFromPointer, fireZone]);

  const handlePointerUp = useCallback(() => {
    setActiveZone(null);
    setLoupeSvgY(null);
  }, []);

  const ZONE_Y = {
    finish:     { y1: 2,              y2: PIN_DECK_H - 2  },
    brk:        { y1: PIN_DECK_H,     y2: ARROW_LINE_Y    },
    target:     { y1: ARROW_LINE_Y,   y2: FOUL_Y          },
    foot_slide: { y1: APPROACH_Y0,    y2: APPROACH_MID_Y  },
    foot_start: { y1: APPROACH_MID_Y, y2: H_LANE - 4      },
  };

  const crosshairBoard = activeZone === 'target'     ? target
    : activeZone === 'brk'        ? brk
    : activeZone === 'foot_start' ? stanceB
    : activeZone === 'foot_slide' ? slideB
    : activeZone === 'finish'     ? (finish ?? 20)
    : null;
  const crosshairX = crosshairBoard != null ? bowlerX(crosshairBoard, hand, offsetX) : null;

  const makeShotPath = (releaseBd, tgt, brkBd, finBd) => {
    const sx = bowlerX(clamp(releaseBd, 1, LANE_BOARDS), hand, offsetX);
    const tx = bowlerX(clamp(tgt,       1, LANE_BOARDS), hand, offsetX);
    const bx = bowlerX(clamp(brkBd,     1, LANE_BOARDS), hand, offsetX);
    const fx = bowlerX(clamp(finBd,     1, LANE_BOARDS), hand, offsetX);
    const ddx = bx - tx;
    const ddy = oilTop - ARROW_LINE_Y;
    const k   = (Math.sqrt((fx - bx) ** 2 + (PIN_ROW_Y[0] - oilTop) ** 2) * 0.55)
              / (Math.sqrt(ddx * ddx + ddy * ddy) || 1);
    return `M ${sx} ${FOUL_Y} L ${tx} ${ARROW_LINE_Y} L ${bx} ${oilTop} Q ${bx + ddx * k} ${oilTop + ddy * k} ${fx} ${PIN_ROW_Y[0]}`;
  };

  const ballPath = (() => {
    if (isReview || !tweaks.showPath) return null;
    const fin = mode === 'record' && finish != null ? finish : 17;
    const rel = mode === 'plan' ? ballRelease : (result.slide - session.ballOffset);
    return makeShotPath(rel, target, brk, fin);
  })();

  // Extended zone geometry (above foul line)
  const extGutterBoards = 8;
  const extWallBoards   = 3;
  const extAreaX    = hand === 'R' ? 0 : offsetX + LANE_W;
  const extGutterX  = hand === 'R' ? extWallBoards * BOARD_W : extAreaX;
  const extWallX    = hand === 'R' ? 0 : extAreaX + extGutterBoards * BOARD_W;
  const extGutterW  = extGutterBoards * BOARD_W;
  const extWallW    = extWallBoards   * BOARD_W;

  return (
    <svg
      ref={svgRef}
      viewBox={`${vbState.x} 0 ${vbState.w} ${H_LANE}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'crosshair',
               aspectRatio: `${vbState.w} / ${H_LANE}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <linearGradient id="lu-pinDeckGrad" x1="0" y1="0" x2="0" y2={PIN_DECK_H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c2014" /><stop offset="1" stopColor="#42321f" />
        </linearGradient>
        <linearGradient id="lu-approachGrad" x1="0" y1={APPROACH_Y0} x2="0" y2={H_LANE} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c9a26c" /><stop offset="1" stopColor="#b78a52" />
        </linearGradient>
        <linearGradient id="lu-foulGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.4" /><stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lu-oilGloss" x1="0" y1={oilTop} x2="0" y2={FOUL_Y} gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="rgba(180,200,230,0.18)" />
          <stop offset="0.55" stopColor="rgba(180,200,230,0.06)" />
          <stop offset="1"    stopColor="rgba(180,200,230,0)"    />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x="0" y="0" width={W_LANE} height={H_LANE} fill={C.bg} />

      {/* ── EXTENDED ZONE — above foul line (gutter + wall) ── */}
      {/* Rendered unconditionally; viewBox animation hides it when collapsed */}
      <rect x={extGutterX} y={PIN_DECK_H} width={extGutterW} height={LANE_H_PX} fill={C.extGutter} />
      {Array.from({ length: extGutterBoards }, (_, i) => (
        <rect key={`eg-${i}`} x={extGutterX + i * BOARD_W + BOARD_W - 0.4}
              y={PIN_DECK_H} width={0.4} height={LANE_H_PX} fill="rgba(0,0,0,0.12)" />
      ))}
      <rect x={extWallX} y={PIN_DECK_H} width={extWallW} height={LANE_H_PX} fill={C.extWall} />
      <rect x={extGutterX} y={0} width={extGutterW} height={PIN_DECK_H} fill="url(#lu-pinDeckGrad)" />
      <rect x={extWallX}   y={0} width={extWallW}   height={PIN_DECK_H} fill={C.extWall} />

      {/* ── EXTENDED APPROACH — boards 40–50 ── */}
      {/* Same look as main approach: every 5th board (40, 45, 50) is a marker board */}
      {Array.from({ length: EXT_BOARDS }, (_, i) => {
        const extBoardIdx = i + 1;
        const bowlerBoard = LANE_BOARDS + extBoardIdx;
        const isMark = bowlerBoard % 5 === 0;
        const bx = hand === 'R'
          ? offsetX - extBoardIdx * BOARD_W
          : offsetX + LANE_W + (extBoardIdx - 1) * BOARD_W;
        return (
          <g key={`eab-${i}`}>
            <rect x={bx} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                  fill={isMark ? C.approachMarker : C.approachSurf} />
            <rect x={bx + BOARD_W - 0.4} y={APPROACH_Y0} width={0.4} height={APPROACH_H}
                  fill="rgba(0,0,0,0.18)" />
            {isMark && tweaks.markerContrast > 0 && (
              <rect x={bx} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                    fill="#000" opacity={tweaks.markerContrast * 0.12} />
            )}
          </g>
        );
      })}

      {/* ── PIN DECK ── */}
      <rect x={offsetX} y="0" width={LANE_W} height={PIN_DECK_H} fill="url(#lu-pinDeckGrad)" />
      {Array.from({ length: LANE_BOARDS }, (_, i) => i + 1).map(pb => (
        <rect key={`pds-${pb}`} x={(pb - 1) * BOARD_W + offsetX + BOARD_W - 0.4} y={4}
              width={0.4} height={PIN_DECK_H - 8} fill="rgba(255,255,255,0.06)" />
      ))}

      {isReview && reviewShots?.map((s, i) => {
        const atPocket = Math.abs(s.actual_finish - 17) <= 1;
        const color = atPocket ? C.stance : C.target;
        const px = (bowlerToPhys(s.actual_finish, hand) - 1) * BOARD_W + offsetX;
        return (
          <g key={`rf-${i}`}>
            <rect x={px} y={PIN_DECK_H - 18} width={BOARD_W} height={14}
                  fill={color} opacity={atPocket ? 0.55 : 0.3} rx={2} />
          </g>
        );
      })}

      {!isReview && finish != null && (() => {
        const isActive = activeZone === 'finish';
        const cx   = bowlerX(finish, hand, offsetX);
        const fx   = (bowlerToPhys(finish, hand) - 1) * BOARD_W + offsetX;
        const w    = isActive ? BOARD_W * 2.5 : BOARD_W;
        const xOff = isActive ? BOARD_W * 0.75 : 0;
        const side = hand === 'R' ? -1 : 1;
        const pillCx = isActive ? clamp(cx + side * (w / 2 + 15), 14, W_LANE - 14) : cx;
        const pillCy = isActive ? PIN_DECK_H / 2 : PIN_DECK_H + 22;
        return (
          <g>
            {isActive && <rect x={fx - xOff - 3} y={0} width={w + 6} height={PIN_DECK_H} fill={C.finish} opacity={0.12} />}
            <rect x={fx - xOff} y={2} width={w} height={PIN_DECK_H - 4} fill={C.finish} opacity={isActive ? 0.45 : 0.55} />
            <rect x={fx - xOff} y={2} width={w} height={PIN_DECK_H - 4} fill="none" stroke={C.finish} strokeWidth={isActive ? 2.5 : 1.5} />
            {!isActive && <MarkerPill cx={pillCx} cy={pillCy} label={finish} color={C.finish} />}
          </g>
        );
      })()}

      {PINS.map(p => (
        <PinGlyph key={p.n} cx={physX(p.pb, offsetX)} cy={PIN_ROW_Y[p.row]}
                  label={p.n} showNumber={tweaks.showPinNumbers} />
      ))}
      <rect x={offsetX} y={PIN_DECK_H - 2} width={LANE_W} height={3} fill="rgba(0,0,0,0.55)" />

      {/* ── LANE BOARDS ── */}
      {Array.from({ length: LANE_BOARDS }, (_, i) => i + 1).map(pb => (
        <LaneBoardColumn key={`lb-${pb}`} pb={pb} oilTop={oilTop}
                         markerContrast={tweaks.markerContrast} offsetX={offsetX} />
      ))}
      <rect x={offsetX + 1} y={oilTop} width={LANE_W - 2} height={FOUL_Y - oilTop} fill="url(#lu-oilGloss)" />
      <rect x={offsetX}               y={PIN_DECK_H} width={1.4} height={LANE_H_PX} fill={C.gutter} opacity={0.75} />
      <rect x={offsetX + LANE_W - 1.4} y={PIN_DECK_H} width={1.4} height={LANE_H_PX} fill={C.gutter} opacity={0.75} />

      {/* Pattern line */}
      <line x1={offsetX + 4} y1={oilTop} x2={offsetX + LANE_W - 4} y2={oilTop}
            stroke={C.patternLine} strokeWidth={1.1} strokeDasharray="6 4" opacity={0.85} />
      <g>
        <rect x={offsetX + LANE_W - 90} y={oilTop - 11} width={84} height={18}
              rx={9} fill="rgba(20,17,13,0.78)" stroke={C.patternLine} strokeWidth={0.7} />
        <text x={offsetX + LANE_W - 48} y={oilTop + 2} textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace" fontSize={10} fontWeight={600}
              fill={C.patternLine} letterSpacing="0.08em">
          {(session.patternLabel || `${session.patternLength} FT`).toUpperCase()}
        </text>
      </g>

      {LANE_DOT_BOARDS.map(pb => (
        <circle key={`ld-${pb}`} cx={physX(pb, offsetX)} cy={LANE_DOT_Y} r={2.4} fill={C.dot} opacity={0.92} />
      ))}

      {ARROW_BOARDS.map(pb => {
        const cx      = physX(pb, offsetX);
        const half    = ARROW_W / 2;
        const isAimed = bowlerToPhys(target, hand) === pb;
        return (
          <g key={`ar-${pb}`}>
            <polygon points={`${cx},${ARROW_TOP_Y} ${cx - half},${ARROW_BOTTOM_Y} ${cx + half},${ARROW_BOTTOM_Y}`} fill={C.arrow} />
            {isAimed && (
              <polygon points={`${cx},${ARROW_TOP_Y - 1.4} ${cx - half - 1},${ARROW_BOTTOM_Y + 0.6} ${cx + half + 1},${ARROW_BOTTOM_Y + 0.6}`}
                       fill="none" stroke={C.target} strokeWidth={2.2} />
            )}
          </g>
        );
      })}

      {isReview && reviewShots?.map((s, i) => {
        const isRecent = i === reviewShots.length - 1;
        const atPocket = Math.abs(s.actual_finish - 17) <= 1;
        const color    = atPocket ? C.stance : C.target;
        const d = makeShotPath(s.actual_foot - (session.ballOffset ?? 5), s.actual_target, s.actual_breakpoint, s.actual_finish);
        return (
          <g key={`rp-${i}`} pointerEvents="none">
            <path d={d} fill="none" stroke={color} strokeOpacity={isRecent ? 0.7 : 0.3}
                  strokeWidth={isRecent ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}

      {ballPath && (
        <g pointerEvents="none">
          <path d={ballPath} fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          <path d={ballPath} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {/* TARGET marker */}
      {!isReview && (() => {
        const cx = bowlerX(target, hand, offsetX);
        const isActive = activeZone === 'target';
        const r    = isActive ? 15 : 8.5;
        const side = hand === 'R' ? -1 : 1;
        const pillCx = isActive ? clamp(cx + side * (22 + 15), 14, W_LANE - 14) : cx;
        const pillCy = isActive ? ARROW_LINE_Y : ARROW_LINE_Y + 30;
        return (
          <g>
            {isActive && <circle cx={cx} cy={ARROW_LINE_Y} r={22} fill={C.target} opacity={0.18} />}
            <circle cx={cx} cy={ARROW_LINE_Y} r={r} fill="none" stroke={C.target} strokeWidth={2.4} />
            <circle cx={cx} cy={ARROW_LINE_Y} r={2.6} fill={C.target} />
            {!isActive && <MarkerPill cx={pillCx} cy={pillCy} label={target} color={C.target} />}
          </g>
        );
      })()}

      {/* BREAKPOINT marker */}
      {!isReview && (() => {
        const cx = bowlerX(brk, hand, offsetX);
        return (
          <g>
            <line x1={cx} y1={oilTop - 7} x2={cx} y2={oilTop + 7} stroke={C.brk} strokeWidth={2.5} />
            <circle cx={cx} cy={oilTop} r={8.5} fill="none" stroke={C.brk} strokeWidth={2.4} />
            <circle cx={cx} cy={oilTop} r={2.6} fill={C.brk} />
            <MarkerPill cx={cx} cy={oilTop + 30} label={brk} color={C.brk} />
          </g>
        );
      })()}

      {/* FOUL LINE */}
      <rect x="0" y={FOUL_Y - 3} width={W_LANE} height={3} fill="url(#lu-foulGlow)" opacity={0.7} />
      <rect x="0" y={FOUL_Y}     width={W_LANE} height={FOUL_THICK} fill={C.foulLine} />
      <rect x="0" y={FOUL_Y + FOUL_THICK} width={W_LANE} height={1.5} fill="rgba(0,0,0,0.4)" />

      {/* ── APPROACH — 39 lane boards ── */}
      <rect x={offsetX} y={APPROACH_Y0} width={LANE_W} height={APPROACH_H} fill="url(#lu-approachGrad)" />
      {Array.from({ length: LANE_BOARDS }, (_, i) => i + 1).map(pb => {
        const isMark = ARROW_BOARDS.includes(pb);
        const x = (pb - 1) * BOARD_W + offsetX;
        return (
          <g key={`ab-${pb}`}>
            <rect x={x} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                  fill={isMark ? C.approachMarker : C.approachSurf} />
            <rect x={x + BOARD_W - 0.4} y={APPROACH_Y0} width={0.4} height={APPROACH_H} fill="rgba(0,0,0,0.18)" />
            {isMark && tweaks.markerContrast > 0 && (
              <rect x={x} y={APPROACH_Y0} width={BOARD_W} height={APPROACH_H}
                    fill="#000" opacity={tweaks.markerContrast * 0.12} />
            )}
          </g>
        );
      })}

      <rect x="0" y={APPROACH_Y0} width={W_LANE} height={2}   fill="rgba(0,0,0,0.4)" />
      <rect x="0" y={H_LANE - 2}  width={W_LANE} height={2}   fill="rgba(0,0,0,0.4)" />

      {tweaks.showApproachDots && APPROACH_DOT_BOARDS.map(pb => (
        <circle key={`ad-${pb}`} cx={physX(pb, offsetX)} cy={APPROACH_DOT_Y} r={2.2} fill={C.dot} opacity={0.9} />
      ))}

      <line x1={0} y1={APPROACH_MID_Y} x2={W_LANE} y2={APPROACH_MID_Y} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      <text x={offsetX + 5} y={APPROACH_Y0 + 11} fontFamily="'JetBrains Mono', monospace"
            fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.45)" letterSpacing="0.1em">SLIDE</text>
      <text x={offsetX + 5} y={APPROACH_MID_Y + 11} fontFamily="'JetBrains Mono', monospace"
            fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.45)" letterSpacing="0.1em">START</text>

      {/* SLIDE FOOT marker */}
      {!isReview && slideB != null && (() => {
        const isPlan   = mode === 'plan';
        const isActive = activeZone === 'foot_slide';
        const cx   = bowlerX(slideB, hand, offsetX);
        const rw   = BOARD_W * (isActive ? 3 : 2.2);
        const side = hand === 'R' ? -1 : 1;
        const pillCx = isActive ? clamp(cx + side * (rw / 2 + 15), 14, W_LANE - 14) : cx;
        const pillCy = isActive ? SLIDE_MARKER_Y : SLIDE_MARKER_Y + 30;
        return (
          <g opacity={isPlan ? 0.55 : 1}>
            {isActive && <rect x={cx - rw / 2 - 6} y={SLIDE_MARKER_Y - 17} width={rw + 12} height={34} rx={8} fill={C.stance} opacity={0.18} />}
            <rect x={cx - rw / 2} y={SLIDE_MARKER_Y - 11} width={rw} height={22} rx={5}
                  fill={isPlan ? 'none' : C.stance} stroke={C.stance}
                  strokeWidth={isActive ? 2.5 : 2} strokeDasharray={isPlan ? '4 3' : '0'} />
            {!isActive && <MarkerPill cx={pillCx} cy={pillCy} label={slideB} color={C.stance} />}
          </g>
        );
      })()}

      {/* START FOOT marker */}
      {!isReview && stanceB != null && (() => {
        const isActive = activeZone === 'foot_start';
        const cx   = bowlerX(stanceB, hand, offsetX);
        const rcy  = APPROACH_DOT_Y + 23;
        const rw   = BOARD_W * (isActive ? 3 : 2.2);
        const side = hand === 'R' ? -1 : 1;
        const pillCx = isActive ? clamp(cx + side * (rw / 2 + 15), 14, W_LANE - 14) : cx;
        const pillCy = isActive ? rcy : rcy + 30;
        return (
          <g opacity={0.9}>
            {isActive && <rect x={cx - rw / 2 - 6} y={rcy - 17} width={rw + 12} height={34} rx={8} fill={C.stance} opacity={0.18} />}
            <rect x={cx - rw / 2} y={rcy - 11} width={rw} height={22} rx={5}
                  fill="none" stroke={C.stance}
                  strokeWidth={isActive ? 2.5 : 1.8} strokeDasharray={isActive ? '0' : '5 3'} />
            {!isActive && <MarkerPill cx={pillCx} cy={pillCy} label={stanceB} color={C.stance} />}
          </g>
        );
      })()}

      {/* Hand label */}
      <g opacity={0.55}>
        <text x={hand === 'R' ? W_LANE - 10 : 10} y={PIN_DECK_H + 14}
              textAnchor={hand === 'R' ? 'end' : 'start'}
              fontFamily="'JetBrains Mono', monospace" fontSize={9} fontWeight={600} fill="rgba(58,37,22,0.8)">
          {hand === 'R' ? 'R-HAND ›' : '‹ L-HAND'}
        </text>
        <text x={hand === 'R' ? W_LANE - 4 : offsetX + 4} y={FOUL_Y - 4}
              textAnchor={hand === 'R' ? 'end' : 'start'}
              fontFamily="'JetBrains Mono', monospace" fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.55)">1</text>
        <text x={hand === 'R' ? offsetX + 4 : W_LANE - 4} y={FOUL_Y - 4}
              textAnchor={hand === 'R' ? 'start' : 'end'}
              fontFamily="'JetBrains Mono', monospace" fontSize={8} fontWeight={600} fill="rgba(58,37,22,0.55)">39</text>
      </g>

      {/* CROSSHAIR */}
      {activeZone && crosshairX != null && (() => {
        const { y1, y2 } = ZONE_Y[activeZone];
        const color = ZONE_COLOR[activeZone];
        return (
          <g pointerEvents="none">
            <line x1={crosshairX} y1={y1} x2={crosshairX} y2={y2} stroke="rgba(0,0,0,0.55)" strokeWidth={5} />
            <line x1={crosshairX} y1={y1} x2={crosshairX} y2={y2} stroke={color} strokeWidth={2.5} strokeDasharray="7 4" />
          </g>
        );
      })()}

      {/* DRAG LOUPE */}
      {activeZone && crosshairX != null && loupeSvgY != null && (() => {
        const R  = 50;
        const lx = clamp(crosshairX, vbState.x + R + 4, vbState.x + vbState.w - R - 4);
        const ly = clamp(loupeSvgY - R - 20, R + 4, H_LANE - R - 20);
        return (
          <BoardLoupe cx={lx} cy={ly} board={crosshairBoard} color={ZONE_COLOR[activeZone]} />
        );
      })()}
    </svg>
  );
}
