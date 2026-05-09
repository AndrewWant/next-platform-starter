'use client';

import { useState, useReducer, useCallback, useMemo } from 'react';
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
import HamburgerMenu from '../../../components/lineup/HamburgerMenu';

// ─── Plan geometry ────────────────────────────────────────────────────────────

// Given target and breakpoint, derive all other values for a planned line.
function computePlan({ target, brk, patternLength, ballOffset, drift }) {
  const slope       = (brk - target) / (patternLength - 15);
  const ballRelease = target - 15 * slope;
  const slideFoot   = ballRelease + ballOffset;
  const setupFoot   = Math.round(slideFoot - drift);
  const ballStart   = setupFoot - ballOffset;
  return { ballRelease, slideFoot, setupFoot, ballStart, slope };
}

// Expected breakpoint hint for the record-mode readout (setup foot → geometric brk).
function expectedBreakpoint(setupFoot, target, { patternLength, ballOffset, drift }) {
  const ballRelease = (setupFoot + drift) - ballOffset;
  const slope       = (target - ballRelease) / 15;
  return Math.round(target + slope * (patternLength - 15));
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const POCKET = 17;

// ─── Tweaks defaults ──────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = {
  showPinNumbers:    true,
  showPath:          false,
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

  // Plan: target and breakpoint are the two independent inputs.
  // Foot always derives from computePlan(target, brk).
  const [planTarget, setPlanTarget] = useState(10);
  const [planBrk,    setPlanBrk]    = useState(7);

  // Record: all four values independently set.
  // "foot" = setup foot (where the bowler stands before approach).
  const [recFoot,   setRecFoot]   = useState(null);
  const [recTarget, setRecTarget] = useState(null);
  const [recBrk,    setRecBrk]    = useState(null);
  const [recFinish, setRecFinish] = useState(POCKET);

  // ── Session start ──────────────────────────────────────────────────────────

  const handleStart = useCallback((cfg) => {
    initSession(cfg.patternLength, cfg.ballOffset, cfg.hand === 'R' ? 'right' : 'left');
    startSession(cfg.ballName, cfg.ballNotes);
    setSessionCfg(cfg);
    setMode('plan');
    setEditIndex(null);
    const brkBase = cfg.patternLength - 31;
    setPlanBrk(clamp(brkBase, 1, 39));
    setPlanTarget(10);
    refresh();
  }, [refresh]);

  const handleImport = useCallback((json) => {
    importSessionJSON(json);
    const s = State.session;
    setSessionCfg({
      patternLength: s.patternLength,
      patternLabel:  '',
      ballOffset:    s.ballToSlideFoot,
      drift:         0,
      hand:          s.handedness === 'left' ? 'L' : 'R',
      ballName:      '',
      ballNotes:     '',
    });
    setMode('plan');
    setEditIndex(null);
    refresh();
  }, [refresh]);

  const handleRestart = useCallback(() => {
    setSessionCfg(null);
    setMode('plan');
    setEditIndex(null);
  }, []);

  // ── Derived plan values ────────────────────────────────────────────────────

  const planDerived = useMemo(() => {
    if (!sessionCfg) return { setupFoot: 20, slideFoot: 20, ballStart: 15, ballRelease: 15, slope: 0 };
    return computePlan({
      target:        planTarget,
      brk:           planBrk,
      patternLength: sessionCfg.patternLength,
      ballOffset:    sessionCfg.ballOffset,
      drift:         sessionCfg.drift,
    });
  }, [planTarget, planBrk, sessionCfg]);

  // Setup foot, always derived from target + brk via computePlan.
  const planFoot = Math.round(planDerived.setupFoot);

  // ── Lane drag callbacks ────────────────────────────────────────────────────
  //
  // Plan mode interaction model:
  //   drag target → target changes, foot re-derives (brk fixed)
  //   drag brk    → brk changes, target back-computes to keep foot fixed, foot re-derives
  //   drag foot   → foot back-computes target so the derived foot ≈ dragged board (brk fixed)
  //
  // In all plan cases brk or target is the primary input and foot is always derived.

  const laneOn = useMemo(() => ({
    target: (b) => {
      if (mode === 'plan') {
        // target changes → brk re-derives from move table (current foot + new target → new brk)
        const newBrk = LaneRead.expectedBreakpoint(planDerived.slideFoot, b);
        setPlanTarget(b);
        setPlanBrk(clamp(newBrk, 1, 39));
      } else {
        setRecTarget(b);
      }
    },
    brk: (b) => {
      if (mode === 'plan') {
        // brk changes → target stays, foot re-derives automatically via computePlan
        setPlanBrk(b);
      } else {
        setRecBrk(b);
      }
    },
    foot: (b) => {
      if (mode === 'plan') {
        // foot drag → target moves to keep brk the same (move table inverse)
        // slideFoot = (target - brk) * 1.68 + brk + BALL_TO_SLIDE_FOOT
        // → target = (slideFoot - BALL_TO_SLIDE_FOOT - brk) / 1.68 + brk
        const slideFoot = b + (sessionCfg?.drift ?? 0);
        const rawTarget = (slideFoot - CONSTANTS.BALL_TO_SLIDE_FOOT - planBrk) / 1.68 + planBrk;
        if (rawTarget >= 1 && rawTarget <= 39) {
          setPlanTarget(Math.round(rawTarget));
          // planBrk stays unchanged
        } else {
          // target would be out of range: clamp target and also adjust brk
          const newTarget = clamp(Math.round(rawTarget), 1, 39);
          const newBrk    = LaneRead.expectedBreakpoint(slideFoot, newTarget);
          setPlanTarget(newTarget);
          setPlanBrk(clamp(newBrk, 1, 39));
        }
      } else {
        setRecFoot(b);
      }
    },
    finish: (b) => setRecFinish(b),
  }), [mode, planDerived, planBrk, sessionCfg]);

  // ── Mode switching ─────────────────────────────────────────────────────────

  const enterRecord = useCallback(() => {
    if (editIndex == null) {
      setRecFoot(planFoot);
      setRecTarget(planTarget);
      setRecBrk(planBrk);
      setRecFinish(POCKET);
    }
    setMode('record');
  }, [editIndex, planFoot, planTarget, planBrk]);

  const enterPlan = useCallback(() => {
    setEditIndex(null);
    setMode('plan');
  }, []);

  // ── Save shot ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const actualFoot   = recFoot   ?? planFoot;
    const actualTarget = recTarget ?? planTarget;
    const actualBrk    = recBrk    ?? planBrk;

    const planned = {
      foot:   planFoot,
      target: planTarget,
      brk:    planBrk,
      finish: POCKET,
    };
    const actual = {
      foot:   actualFoot,
      target: actualTarget,
      brk:    actualBrk,
      finish: recFinish,
    };

    if (editIndex != null) {
      updateShot(editIndex, planned, actual);
      setEditIndex(null);
    } else {
      recordShot(planned, actual);
    }

    // ── Post-save suggestion ────────────────────────────────────────────────
    const lr    = State.laneRead;
    const shots = lr?.shots ?? [];
    const breakpointBase = (sessionCfg?.patternLength ?? 42) - 31;

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

    setPlanTarget(nextTarget);
    setPlanBrk(nextBrk);
    setMode('plan');
    refresh();
  }, [
    planFoot, planTarget, planBrk,
    recFoot, recTarget, recBrk, recFinish,
    editIndex, sessionCfg, refresh,
  ]);

  // ── Edit / remove ──────────────────────────────────────────────────────────

  const handleEdit = useCallback((index) => {
    const history = getShotHistory();
    const shot    = history.find(s => s.index === index);
    if (!shot) return;
    setRecFoot(shot.actual.foot);
    setRecTarget(shot.actual.target);
    setRecBrk(shot.actual.brk);
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
        <SetupScreen onStart={handleStart} onImport={handleImport} />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────

  const history   = getShotHistory();
  const balls     = getBalls();
  const shotCount = history.length;

  // "foot" everywhere in the UI = setup foot (where bowler stands).
  // plan.foot and result.foot are both setup foot.
  const planObj = {
    foot:    planFoot,
    target:  planTarget,
    brk:     planBrk,
    derived: planDerived,
  };

  const resultFoot = recFoot ?? planFoot;
  const resultObj = {
    foot:   resultFoot,
    target: recTarget ?? planTarget,
    brk:    recBrk    ?? planBrk,
    finish: recFinish,
  };

  // Expected breakpoint shown as a hint on the BP chip in record mode.
  const expectedBP = sessionCfg
    ? expectedBreakpoint(resultObj.foot, resultObj.target, sessionCfg)
    : null;

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
          <span className="lu-tab-sub">target · breakpoint · foot</span>
        </button>
        <button className={`lu-tab${mode === 'record' ? ' on' : ''}`} onClick={enterRecord}>
          <span className="lu-tab-label">{editIndex != null ? 'Edit shot' : 'Record'}</span>
          <span className="lu-tab-sub">
            {editIndex != null ? `#${shotCount - editIndex}` : 'foot · target · BP · finish'}
          </span>
        </button>
      </div>

      {/* ── READOUTS ── */}
      <div className="lu-readouts">
        {mode === 'plan' ? (
          <>
            <Chip color="var(--lu-target)" label="Target"     value={planTarget} />
            <Chip color="var(--lu-brk)"    label="Breakpoint" value={planBrk} />
            <Chip color="var(--lu-stance)" label="Foot"       value={planFoot} />
          </>
        ) : (
          <>
            <Chip color="var(--lu-stance)" label="Foot"       value={resultObj.foot} />
            <Chip color="var(--lu-target)" label="Target"     value={resultObj.target} />
            <Chip color="var(--lu-brk)"    label="Breakpoint" value={resultObj.brk}
                  hint={`exp ${expectedBP}`} />
            <Chip color="var(--lu-finish)" label="Finish"     value={resultObj.finish} />
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
              finish {resultObj.finish} · target {resultObj.target} · BP {resultObj.brk}
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
            onClose={() => setDrawer(null)}
          />
        </Drawer>
      )}
    </div>
  );
}

// ─── Chip readout ─────────────────────────────────────────────────────────────

function Chip({ color, label, value, hint }) {
  return (
    <div className="lu-chip">
      <span className="lu-chip-bar" style={{ background: color }} />
      <div className="lu-chip-body">
        <div className="lu-chip-label">{label}</div>
        <div className="lu-chip-value">{value ?? '—'}</div>
        {hint && (
          <div style={{ fontSize:9.5, color:'var(--lu-txt-3)', fontFamily:"'JetBrains Mono', monospace" }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
