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

function computePlan({ target, brk, patternLength, ballOffset, drift }) {
  const slope      = (brk - target) / (patternLength - 15);
  const ballRelease = target - 15 * slope;
  const slideFoot  = ballRelease + ballOffset;
  const setupFoot  = Math.round(slideFoot - drift);
  const ballStart  = setupFoot - ballOffset;
  return { ballRelease, slideFoot, setupFoot, ballStart, slope };
}

function expectedBreakpoint({ foot, target, patternLength, ballOffset }) {
  const ballRelease = foot - ballOffset;
  const slope       = (target - ballRelease) / 15;
  return Math.round(ballRelease + slope * patternLength);
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const POCKET = 17;

// ─── Top-level tweaks defaults ────────────────────────────────────────────────

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

  const [sessionCfg, setSessionCfg] = useState(null);  // null = setup screen
  const [mode,       setMode]       = useState('plan'); // 'plan' | 'record'
  const [editIndex,  setEditIndex]  = useState(null);
  const [drawer,     setDrawer]     = useState(null);   // 'history' | 'menu' | null
  const [tweaks,     setTweaks]     = useState(TWEAK_DEFAULTS);

  // Plan state: all three values are draggable
  const [planTarget, setPlanTarget] = useState(10);
  const [planBrk,    setPlanBrk]    = useState(7);
  const [planFoot,   setPlanFoot]   = useState(null);  // null = derived
  const [footPinned, setFootPinned] = useState(false); // true = user manually set foot

  // Record state
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
    setFootPinned(false);
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

  // Effective plan foot: pinned override OR derived
  const effectivePlanFoot = footPinned && planFoot != null ? planFoot : planDerived.setupFoot;

  // ── Lane callbacks ─────────────────────────────────────────────────────────

  const laneOn = useMemo(() => ({
    target: (b) => {
      if (mode === 'plan') {
        setPlanTarget(b);
        if (!footPinned) setFootPinned(false); // keep derived
      } else {
        setRecTarget(b);
      }
    },
    brk: (b) => {
      if (mode === 'plan') {
        setPlanBrk(b);
        if (!footPinned) setFootPinned(false);
      } else {
        setRecBrk(b);
      }
    },
    foot: (b) => {
      if (mode === 'plan') {
        setPlanFoot(b);
        setFootPinned(true);
      } else {
        setRecFoot(b);
      }
    },
    finish: (b) => setRecFinish(b),
  }), [mode, footPinned]);

  // ── Mode switching ─────────────────────────────────────────────────────────

  const enterRecord = useCallback(() => {
    if (editIndex == null) {
      // Pre-fill from plan
      setRecFoot(effectivePlanFoot);
      setRecTarget(planTarget);
      setRecBrk(planBrk);
      setRecFinish(POCKET);
    }
    setMode('record');
  }, [editIndex, effectivePlanFoot, planTarget, planBrk]);

  const enterPlan = useCallback(() => {
    setEditIndex(null);
    setMode('plan');
  }, []);

  // ── Save shot ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const planned = {
      foot:   effectivePlanFoot,
      target: planTarget,
      brk:    planBrk,
      finish: POCKET,
    };
    const actual = {
      foot:   recFoot   ?? effectivePlanFoot,
      target: recTarget ?? planTarget,
      brk:    recBrk    ?? planBrk,
      finish: recFinish,
    };

    if (editIndex != null) {
      updateShot(editIndex, planned, actual);
      setEditIndex(null);
    } else {
      recordShot(planned, actual);
    }

    // ── Post-save suggestion ────────────────────────────────────────────────
    const lr     = State.laneRead;
    const shots  = lr?.shots ?? [];
    const breakpointBase = (sessionCfg?.patternLength ?? 42) - 31;

    let nextTarget = planTarget;
    let nextBrk    = planBrk;

    if (shots.length === 1) {
      // Exploration: first shot hit pocket near the rule-of-31 breakpoint base
      const atBase   = Math.abs(actual.brk    - breakpointBase) <= CONSTANTS.BREAKPOINT_LEEWAY;
      const atPocket = Math.abs(actual.finish  - POCKET)        <= 1;
      if (atBase && atPocket) {
        nextTarget = clamp(actual.target + 3, 1, 39);
        nextBrk    = clamp(actual.brk    + 3, 1, 39);
      } else if (State.suggestion) {
        nextTarget = State.suggestion.target      ?? planTarget;
        nextBrk    = State.suggestion.breakpoint  ?? planBrk;
      }
    } else if (State.suggestion) {
      nextTarget = State.suggestion.target      ?? planTarget;
      nextBrk    = State.suggestion.breakpoint  ?? planBrk;
    }

    setPlanTarget(nextTarget);
    setPlanBrk(nextBrk);
    setFootPinned(false);   // re-derive foot from new suggestion
    setMode('plan');
    refresh();
  }, [
    effectivePlanFoot, planTarget, planBrk,
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

  const planObj = {
    foot:   effectivePlanFoot,
    target: planTarget,
    brk:    planBrk,
    derived: planDerived,
  };

  const resultObj = {
    foot:   recFoot   ?? effectivePlanFoot,
    target: recTarget ?? planTarget,
    brk:    recBrk    ?? planBrk,
    finish: recFinish,
  };

  const expectedBP = sessionCfg ? expectedBreakpoint({
    foot:          resultObj.foot,
    target:        resultObj.target,
    patternLength: sessionCfg.patternLength,
    ballOffset:    sessionCfg.ballOffset,
  }) : null;

  const headMeta = sessionCfg
    ? `${sessionCfg.patternLength}ft · ${sessionCfg.hand}H · drift ${sessionCfg.drift}`
    : '';

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
            <Chip color="var(--lu-stance)" label="Foot"       value={effectivePlanFoot} derived={!footPinned} />
            <Chip color="#a98860"          label="Ball/Slide"
                  value={`${Math.round(planDerived.ballStart)}/${Math.round(planDerived.slideFoot)}`}
                  derived small />
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

function Chip({ color, label, value, hint, derived, small }) {
  return (
    <div className="lu-chip">
      <span className="lu-chip-bar" style={{ background: color }} />
      <div className="lu-chip-body">
        <div className="lu-chip-label">
          {label}
          {derived && <span className="lu-chip-tag">derived</span>}
        </div>
        <div className={`lu-chip-value${small ? ' sm' : ''}`}>{value}</div>
        {hint && (
          <div style={{ fontSize:9.5, color:'var(--lu-txt-3)', fontFamily:"'JetBrains Mono', monospace" }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
