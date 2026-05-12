'use client';

import { useState, useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import { CONSTANTS, initSession } from '../../../lib/lineup/constants';
import { LaneRead } from '../../../lib/lineup/models';
import {
  State, startSession, recordShot, updateShot, removeShot,
  addBall, switchBall, wipeBallShots, wipeAllShots,
  exportSessionJSON, importSessionJSON,
  getShotHistory, getBalls,
} from '../../../lib/lineup/state';
import Lane        from '../../../components/lineup/Lane';
import Drawer      from '../../../components/lineup/Drawer';
import SetupScreen from '../../../components/lineup/SetupScreen';
import ShotHistory from '../../../components/lineup/ShotHistory';
import HamburgerMenu   from '../../../components/lineup/HamburgerMenu';
import SessionReview   from '../../../components/lineup/SessionReview';
import WheelChip       from '../../../components/lineup/WheelChip';
import {
  getUserProfile, upsertUserProfile,
  getBalls as getBallsCatalog, createBall,
  createSession as createDbSession,
  addBallToSession,
  saveShot as saveDbShot,
} from './actions';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const POCKET = 17;

// ─── Tweaks defaults ──────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = {
  showPinNumbers:    true,
  showPath:          true,
  showApproachDots:  true,
  markerContrast:    0.6,
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LineupApp() {
  const [, bump]   = useReducer(x => x + 1, 0);
  const refresh    = useCallback(() => bump(), []);

  const [sessionCfg, setSessionCfg] = useState(null);  // null → setup screen
  const [mode,       setMode]       = useState('plan'); // 'plan' | 'record'
  const [editIndex,  setEditIndex]  = useState(null);
  const [drawer,     setDrawer]     = useState(null);   // 'history' | 'menu' | null
  const [tweaks,     setTweaks]     = useState(TWEAK_DEFAULTS);

  // ── Supabase persistence ───────────────────────────────────────────────────
  const [userProfile,   setUserProfile]   = useState(null);
  const [ballCatalog,   setBallCatalog]   = useState([]);
  const [dbSessionId,   setDbSessionId]   = useState(null);
  const [dbLineupBallId, setDbLineupBallId] = useState(null);
  const dbShotCountRef = useRef(0); // tracks how many shots have been persisted

  useEffect(() => {
    getUserProfile().then(p => { if (p) setUserProfile(p); }).catch(() => {});
    getBallsCatalog().then(b => setBallCatalog(b)).catch(() => {});
  }, []);

  // Plan: foot and target are the two independent inputs.
  // Breakpoint is always derived: LaneRead.expectedBreakpoint(slideFoot, target).
  const [planFoot,   setPlanFoot]   = useState(15);
  const [planTarget, setPlanTarget] = useState(10);

  // Record: start foot, slide foot, target, finish independently set. Brk always derived.
  const [recFoot,   setRecFoot]   = useState(null);  // start/setup foot
  const [recSlide,  setRecSlide]  = useState(null);  // slide/finish foot at foul line
  const [recTarget, setRecTarget] = useState(null);
  const [recFinish, setRecFinish] = useState(POCKET);

  // ── Session start ──────────────────────────────────────────────────────────

  const handleStart = useCallback((cfg) => {
    initSession(cfg.patternLength, cfg.ballOffset, cfg.hand === 'R' ? 'right' : 'left');
    startSession(cfg.ballName, cfg.ballNotes);
    setSessionCfg(cfg);
    setMode('plan');
    setEditIndex(null);
    dbShotCountRef.current = 0;
    // Initialise foot from move table: start at target=10, rule-of-31 breakpoint
    const brkBase       = clamp(cfg.patternLength - 31, 1, 39);
    const slideFootInit = LaneRead.footFromTargetAndBreakpoint(10, brkBase).foot;
    setPlanFoot(clamp(Math.round(slideFootInit - cfg.drift), 1, 39));
    setPlanTarget(10);
    refresh();

    // Persist to Supabase (fire-and-forget — in-memory state is source of truth)
    const hand = cfg.hand === 'R' ? 'R' : 'L';
    Promise.all([
      upsertUserProfile({ hand, ball_to_slide_foot: cfg.ballOffset, drift: cfg.drift }),
      createDbSession({
        pattern_label:    cfg.patternLabel || null,
        pattern_length:   cfg.patternLength,
        hand,
        ball_to_slide_foot: cfg.ballOffset,
        drift:            cfg.drift,
      }),
    ]).then(([, sessId]) => {
      setDbSessionId(sessId);
      // Find or create ball in catalog
      const existingBall = cfg.ballId
        ? ballCatalog.find(b => b.id === cfg.ballId)
        : ballCatalog.find(b => b.name.toLowerCase() === (cfg.ballName || '').toLowerCase());
      const ballPromise = existingBall
        ? Promise.resolve(existingBall)
        : createBall({ name: cfg.ballName || 'Ball 1', surface: cfg.surface || null });
      return ballPromise.then(ball => {
        if (!existingBall) setBallCatalog(prev => [...prev, ball]);
        return addBallToSession({ session_id: sessId, ball_id: ball.id, surface: cfg.surface || null });
      });
    }).then(lbId => {
      setDbLineupBallId(lbId);
    }).catch(() => {});
  }, [refresh, ballCatalog]);

  const handleImport = useCallback((json) => {
    importSessionJSON(json);
    const s = State.session;
    const cfg = {
      patternLength: s.patternLength,
      patternLabel:  '',
      ballOffset:    s.ballToSlideFoot,
      drift:         0,
      hand:          s.handedness === 'left' ? 'L' : 'R',
      ballName:      '',
      ballNotes:     '',
    };
    setSessionCfg(cfg);
    setMode('plan');
    setEditIndex(null);
    // Re-derive foot from first shot's target+brk if available
    const lr = State.laneRead;
    if (lr?.shots?.length) {
      const first = lr.shots[0];
      const sfNext = LaneRead.footFromTargetAndBreakpoint(first.target, first.breakpoint).foot;
      setPlanFoot(clamp(Math.round(sfNext - cfg.drift), 1, 39));
      setPlanTarget(first.target);
    } else {
      const brkBase = clamp(s.patternLength - 31, 1, 39);
      const sfInit  = LaneRead.footFromTargetAndBreakpoint(10, brkBase).foot;
      setPlanFoot(clamp(Math.round(sfInit - cfg.drift), 1, 39));
      setPlanTarget(10);
    }
    refresh();
  }, [refresh]);

  const handleRestart = useCallback(() => {
    setSessionCfg(null);
    setMode('plan');
    setEditIndex(null);
    setDbSessionId(null);
    setDbLineupBallId(null);
    dbShotCountRef.current = 0;
  }, []);

  // ── Derived plan values ────────────────────────────────────────────────────
  // Brk is always derived from foot + target via the move table.

  const planDerived = useMemo(() => {
    const drift      = sessionCfg?.drift      ?? 0;
    const ballOffset = sessionCfg?.ballOffset ?? 5;
    const slideFoot  = planFoot + drift;
    const brk        = clamp(LaneRead.expectedBreakpoint(slideFoot, planTarget), 1, 39);
    const ballRelease = slideFoot - ballOffset;
    return { slideFoot, brk, ballRelease };
  }, [planFoot, planTarget, sessionCfg]);

  const planBrk = planDerived.brk;

  // ── Lane drag callbacks ────────────────────────────────────────────────────
  //
  // Plan mode: foot and target are draggable; brk is display-only.
  // Record mode: foot, target, and finish are draggable; brk is display-only.

  const laneOn = useMemo(() => ({
    foot_start: (b) => { if (mode === 'plan') setPlanFoot(b);  else setRecFoot(b);  },
    foot_slide: (b) => { if (mode === 'record') setRecSlide(b); },
    target:     (b) => { if (mode === 'plan') setPlanTarget(b); else setRecTarget(b); },
    brk:        ()  => { /* display only — never interactive */ },
    finish:     (b) => setRecFinish(b),
  }), [mode]);

  // ── Mode switching ─────────────────────────────────────────────────────────

  const enterRecord = useCallback(() => {
    if (editIndex == null) {
      setRecFoot(planFoot);
      setRecSlide(planFoot + (sessionCfg?.drift ?? 0));
      setRecTarget(planTarget);
      setRecFinish(POCKET);
    }
    setMode('record');
  }, [editIndex, planFoot, planTarget, sessionCfg?.drift]);

  const enterPlan = useCallback(() => {
    setEditIndex(null);
    setRecSlide(null);
    setMode('plan');
  }, []);

  // ── Save shot ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const actualFoot   = recFoot   ?? planFoot;
    const actualTarget = recTarget ?? planTarget;
    const actualSlide  = recSlide  ?? (actualFoot + (sessionCfg?.drift ?? 0));
    const actualBrk    = clamp(LaneRead.expectedBreakpoint(actualSlide, actualTarget), 1, 39);

    const planned = {
      foot:   planFoot,
      target: planTarget,
      brk:    planBrk,
      finish: POCKET,
    };
    const actual = {
      foot:   actualFoot,
      slide:  actualSlide,
      target: actualTarget,
      brk:    actualBrk,
      finish: recFinish,
    };

    if (editIndex != null) {
      updateShot(editIndex, planned, actual);
      setEditIndex(null);
    } else {
      recordShot(planned, actual);
      // Persist shot to Supabase (fire-and-forget)
      if (dbSessionId && dbLineupBallId) {
        dbShotCountRef.current += 1;
        const shotNum = dbShotCountRef.current;
        saveDbShot({
          session_id:        dbSessionId,
          ball_id:           dbLineupBallId,
          shot_number:       shotNum,
          planned_foot:      planned.foot,
          planned_target:    planned.target,
          planned_brk:       planned.brk,
          actual_foot_start: actual.foot,
          actual_foot_slide: actual.slide,
          actual_target:     actual.target,
          actual_brk:        actual.brk,
          actual_finish:     actual.finish,
        }).catch(() => {});
      }
    }

    // ── Post-save suggestion ────────────────────────────────────────────────
    const lr    = State.laneRead;
    const shots = lr?.shots ?? [];
    const breakpointBase = (sessionCfg?.patternLength ?? 42) - 31;
    const drift          = sessionCfg?.drift ?? 0;

    let nextTarget = planTarget;
    let nextBrk    = planBrk;

    if (shots.length === 1) {
      const atBase   = Math.abs(actualBrk    - breakpointBase) <= CONSTANTS.BREAKPOINT_LEEWAY;
      const atPocket = Math.abs(actual.finish - POCKET)        <= 1;
      if (atBase && atPocket) {
        nextTarget = clamp(actualTarget + 3, 1, 39);
        nextBrk    = clamp(actualBrk    + 3, 1, 39);
      } else if (State.suggestion) {
        nextTarget = State.suggestion.target     ?? planTarget;
        nextBrk    = State.suggestion.breakpoint ?? planBrk;
      }
    } else if (State.suggestion) {
      nextTarget = State.suggestion.target     ?? planTarget;
      nextBrk    = State.suggestion.breakpoint ?? planBrk;
    }

    // Convert suggestion target+brk back to foot via move table
    setPlanTarget(nextTarget);
    const slideFootNext = LaneRead.footFromTargetAndBreakpoint(nextTarget, nextBrk).foot;
    setPlanFoot(clamp(Math.round(slideFootNext - drift), 1, 39));
    setMode('plan');
    refresh();
  }, [
    planFoot, planTarget, planBrk,
    recFoot, recSlide, recTarget, recFinish,
    editIndex, sessionCfg, refresh,
  ]);

  // ── Edit / remove ──────────────────────────────────────────────────────────

  const handleEdit = useCallback((index) => {
    const history = getShotHistory();
    const shot    = history.find(s => s.index === index);
    if (!shot) return;
    setRecFoot(shot.actual.foot);
    setRecSlide(shot.actual.slide ?? shot.actual.foot);
    setRecTarget(shot.actual.target);
    setRecFinish(shot.actual.finish);
    setEditIndex(index);
    setMode('record');
    setDrawer(null);
  }, []);

  const handleRemove = useCallback((index) => {
    removeShot(index);
    refresh();
  }, [refresh]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const json = exportSessionJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lineup-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Setup screen ───────────────────────────────────────────────────────────

  if (!sessionCfg) {
    return (
      <div className="lu-root">
        <SetupScreen
          onStart={handleStart}
          onImport={handleImport}
          ballCatalog={ballCatalog}
          defaultHand={userProfile?.hand ?? 'R'}
          defaultBallOffset={userProfile?.ball_to_slide_foot ?? 5}
          defaultDrift={userProfile?.drift ?? 2}
        />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────

  const history   = getShotHistory();
  const balls     = getBalls();
  const shotCount = history.length;

  const planObj = {
    foot:    planFoot,
    target:  planTarget,
    brk:     planBrk,
    derived: planDerived,
  };

  const recActualSlide = recSlide ?? ((recFoot ?? planFoot) + (sessionCfg?.drift ?? 0));
  const resultObj = {
    foot:   recFoot   ?? planFoot,
    slide:  recActualSlide,
    target: recTarget ?? planTarget,
    brk:    clamp(LaneRead.expectedBreakpoint(recActualSlide, recTarget ?? planTarget), 1, 39),
    finish: recFinish,
  };

  const headMeta = `${sessionCfg.patternLength}ft · ${sessionCfg.hand}H · drift ${sessionCfg.drift}`;

  return (
    <div className="lu-root">

      {/* ── HEADER ── */}
      <header className="lu-head">
        <button className="lu-icon-btn" onClick={() => setDrawer('menu')} aria-label="Menu">
          <span className="lu-hb-line" />
          <span className="lu-hb-line" />
          <span className="lu-hb-line" />
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span className="lu-brand-mark sm" />
          <span style={{ fontWeight:800, fontSize:14, letterSpacing:'-0.01em', color:'var(--lu-txt)' }}>
            LineUp
          </span>
          <span style={{
            color:'var(--lu-txt-3)', fontSize:10.5,
            fontFamily:"'JetBrains Mono', monospace", letterSpacing:'0.04em',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {headMeta}
          </span>
        </div>
        <button className="lu-head-pill" onClick={() => setDrawer('history')} style={{
          background:'var(--lu-bg-3)', border:'1px solid var(--lu-line)', borderRadius:999,
          padding:'6px 10px', display:'flex', alignItems:'center', gap:6, cursor:'pointer',
          fontFamily:'inherit', color:'var(--lu-txt)',
        }}>
          <span style={{ fontWeight:700, fontSize:13, fontFamily:"'JetBrains Mono', monospace" }}>
            {shotCount}
          </span>
          <span style={{ fontSize:11, color:'var(--lu-txt-2)', letterSpacing:'0.04em' }}>shots</span>
        </button>
      </header>

      {/* ── LANE ── */}
      <div className="lu-lane-wrap">
        <Lane
          session={sessionCfg}
          plan={planObj}
          result={resultObj}
          mode={mode}
          on={laneOn}
          tweaks={tweaks}
        />
      </div>

      {/* ── TABS ── */}
      <div className="lu-tabs">
        <button className={`lu-tab${mode === 'plan' ? ' on' : ''}`} onClick={enterPlan}>
          <span className="lu-tab-label">Plan</span>
          <span className="lu-tab-sub">foot · target</span>
        </button>
        <button className={`lu-tab${mode === 'record' ? ' on' : ''}`} onClick={enterRecord}>
          <span className="lu-tab-label">{editIndex != null ? 'Edit shot' : 'Record'}</span>
          <span className="lu-tab-sub">
            {editIndex != null ? `#${shotCount - editIndex}` : 'foot · target · finish'}
          </span>
        </button>
      </div>

      {/* ── READOUTS ── */}
      <div className="lu-readouts">
        {mode === 'plan' ? (
          <>
            <WheelChip color="var(--lu-stance)" label="Foot"   value={planFoot}   onChange={setPlanFoot}   value2={planDerived.slideFoot} min={-5} max={50} />
            <WheelChip color="var(--lu-target)" label="Target" value={planTarget} onChange={setPlanTarget} />
            <Chip      color="var(--lu-brk)"    label="Exp BP" value={planBrk}    derived />
          </>
        ) : (
          <>
            <WheelChip color="var(--lu-stance)" label="Foot"   value={resultObj.slide}  onChange={setRecSlide}  min={-5} max={50} />
            <WheelChip color="var(--lu-target)" label="Target" value={resultObj.target} onChange={setRecTarget} />
            <Chip      color="var(--lu-brk)"    label="Exp BP" value={resultObj.brk}    derived />
            <WheelChip color="var(--lu-finish)" label="Finish" value={resultObj.finish} onChange={setRecFinish} />
          </>
        )}
      </div>

      {/* ── ACTION ── */}
      <div className="lu-action">
        {mode === 'plan' ? (
          <button className="lu-btn-primary" onClick={enterRecord}>
            <span>Plan looks good →</span>
            <span className="lu-btn-sub">Switch to Record after the throw</span>
          </button>
        ) : (
          <button className="lu-btn-primary" onClick={handleSave}>
            <span>{editIndex != null ? 'Save changes' : 'Save shot'}</span>
            <span className="lu-btn-sub">
              finish {resultObj.finish} · target {resultObj.target} · foot {resultObj.foot}→{resultObj.slide}
            </span>
          </button>
        )}
      </div>

      {/* ── DRAWERS ── */}
      {drawer === 'history' && (
        <Drawer title="Shot history" onClose={() => setDrawer(null)} side="right">
          <ShotHistory shots={history} onEdit={handleEdit} onRemove={handleRemove} />
        </Drawer>
      )}
      {drawer === 'sessions' && (
        <Drawer title="Past sessions" onClose={() => setDrawer(null)} side="right">
          <SessionReview />
        </Drawer>
      )}
      {drawer === 'menu' && (
        <Drawer title="Menu" onClose={() => setDrawer(null)} side="left">
          <HamburgerMenu
            balls={balls}
            tweaks={tweaks}
            setTweak={(k, v) => setTweaks(t => ({ ...t, [k]: v }))}
            onSwitchBall={(id) => { switchBall(id); refresh(); }}
            onAddBall={(name, notes) => { addBall(name, notes); refresh(); }}
            onWipeBall={() => { wipeBallShots(); refresh(); }}
            onWipeAll={() => { wipeAllShots(); refresh(); }}
            onRestart={handleRestart}
            onExport={handleExport}
            onImport={handleImport}
            onViewSessions={() => setDrawer('sessions')}
            onClose={() => setDrawer(null)}
          />
        </Drawer>
      )}
    </div>
  );
}

// ─── Chip readout ─────────────────────────────────────────────────────────────

function Chip({ color, label, value, value2, derived }) {
  return (
    <div className="lu-chip">
      <span className="lu-chip-bar" style={{ background: derived ? 'transparent' : color,
        border: derived ? `1px solid ${color}` : 'none' }} />
      <div className="lu-chip-body">
        <div className="lu-chip-label" style={derived ? { color:'var(--lu-txt-3)', fontStyle:'italic' } : {}}>
          {label}
        </div>
        <div className="lu-chip-value" style={derived ? { color:'var(--lu-txt-2)' } : {}}>
          {value ?? '—'}
          {value2 != null && value2 !== value && (
            <span style={{ color:'var(--lu-txt-3)', fontWeight:500, fontSize:'0.82em' }}>
              →{value2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
