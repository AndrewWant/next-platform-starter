'use client'

import { useState, useReducer, useCallback } from 'react'
import { CONSTANTS, initSession, encodeSessionURL } from '../../../lib/lineup/constants'
import { LaneRead } from '../../../lib/lineup/models'
import {
  State, startSession, recordShot, updateShot, removeShot,
  addBall, switchBall, wipeBallShots, wipeAllShots,
  exportSessionJSON, importSessionJSON, setEditingIndex,
  getShotHistory, getBalls,
} from '../../../lib/lineup/state'
import SetupModal    from '../../../components/lineup/SetupModal'
import SuggestionRow from '../../../components/lineup/SuggestionRow'
import SliderOverlay from '../../../components/lineup/SliderOverlay'
import ShotHistory   from '../../../components/lineup/ShotHistory'
import HamburgerMenu from '../../../components/lineup/HamburgerMenu'

export default function LineupApp() {
  // Force re-render after singleton mutations
  const [, bump] = useReducer(x => x + 1, 0)
  const refresh  = useCallback(() => bump(), [])

  const [sessionStarted, setSessionStarted] = useState(false)
  const [overlayOpen,    setOverlayOpen]    = useState(false)
  const [phase,          setPhase]          = useState('plan')
  const [editIndex,      setEditIndexState] = useState(null)
  const [hamburgerOpen,  setHamburgerOpen]  = useState(false)

  // Plan sliders
  const [planBP,     setPlanBP]     = useState(10)
  const [planTarget, setPlanTarget] = useState(10)

  // Result sliders
  const [resFoot,   setResFoot]   = useState(20)
  const [resTarget, setResTarget] = useState(10)
  const [resBP,     setResBP]     = useState(10)
  const [resFinish, setResFinish] = useState(17)

  // ── Derived ────────────────────────────────────────────────────────────────

  const rtl = CONSTANTS.HANDEDNESS !== 'left'   // right-handed → RTL sliders

  const planDerived = sessionStarted
    ? LaneRead.footFromTargetAndBreakpoint(planTarget, planBP)
    : { foot: 20, ballStart: 15 }

  const expectedBP = sessionStarted
    ? LaneRead.expectedBreakpoint(resFoot, resTarget)
    : 10

  const leeway = CONSTANTS.BREAKPOINT_LEEWAY || 3
  const bpMin  = Math.max(1,  expectedBP - leeway)
  const bpMax  = Math.min(39, expectedBP + leeway)

  // Is this a "explore inside" suggestion (1-shot pocket hit)?
  const lr = State.laneRead
  const isExploration = lr && lr.shots.length === 1 &&
    Math.abs(lr.shots[0].finishPosition - CONSTANTS.POCKET_BOARD) <= 1

  // ── Slider sync helpers ────────────────────────────────────────────────────

  function syncFromSuggestion() {
    const s = State.suggestion
    if (!s) return
    setPlanBP(s.breakpoint)
    setPlanTarget(s.target)
    setResFoot(s.foot)
    setResTarget(s.target)
    setResFinish(CONSTANTS.POCKET_BOARD || 17)
    const expBP = LaneRead.expectedBreakpoint(s.foot, s.target)
    setResBP(Math.max(1, Math.min(39, expBP)))
  }

  function syncFromShot(shot) {
    setPlanBP(shot.breakpoint)
    setPlanTarget(shot.target)
    setResFoot(shot.foot)
    setResTarget(shot.target)
    setResFinish(shot.finishPosition)
    const expBP = LaneRead.expectedBreakpoint(shot.foot, shot.target)
    const clampedBP = Math.max(
      Math.max(1, expBP - leeway),
      Math.min(Math.min(39, expBP + leeway), shot.breakpoint)
    )
    setResBP(clampedBP)
  }

  // ── Session setup ──────────────────────────────────────────────────────────

  function handleStart(patternLength, ballToSlideFoot, handedness, ballName, ballNotes) {
    initSession(patternLength, ballToSlideFoot, handedness)
    startSession(ballName, ballNotes)
    setSessionStarted(true)
    syncFromSuggestion()
    setPhase('plan')
    setOverlayOpen(true)
    refresh()
  }

  function handleImportSetup(json) {
    importSessionJSON(json)
    setSessionStarted(true)
    syncFromSuggestion()
    setPhase('plan')
    setOverlayOpen(true)
    refresh()
  }

  // ── Phase changes ──────────────────────────────────────────────────────────

  function handlePhaseChange(newPhase) {
    if (newPhase === 'result' && phase === 'plan') {
      // Pre-fill result sliders from current plan values
      const { foot } = LaneRead.footFromTargetAndBreakpoint(planTarget, planBP)
      setResFoot(foot)
      setResTarget(planTarget)
      const expBP = LaneRead.expectedBreakpoint(foot, planTarget)
      setResBP(Math.max(bpMin, Math.min(bpMax, expBP)))
      setResFinish(CONSTANTS.POCKET_BOARD || 17)
    }
    setPhase(newPhase)
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  function handleRecord() {
    const clampedBP = Math.max(bpMin, Math.min(bpMax, resBP))
    if (editIndex !== null) {
      updateShot(editIndex, resFoot, resTarget, clampedBP, resFinish)
      setEditIndexState(null)
      setEditingIndex(null)
    } else {
      recordShot(resFoot, resTarget, clampedBP, resFinish)
    }
    syncFromSuggestion()
    setPhase('plan')
    refresh()
  }

  // ── History edit / remove ──────────────────────────────────────────────────

  function handleEdit(index) {
    const shot = State.laneRead.shots[index]
    setEditingIndex(index)
    setEditIndexState(index)
    syncFromShot(shot)
    setPhase('result')
    setOverlayOpen(true)
  }

  function handleRemove(index) {
    removeShot(index)
    setEditIndexState(null)
    setEditingIndex(null)
    syncFromSuggestion()
    setPhase('plan')
    refresh()
  }

  // ── Ball management ────────────────────────────────────────────────────────

  function handleSwitchBall(ballId) {
    switchBall(ballId)
    syncFromSuggestion()
    setEditIndexState(null)
    setPhase('plan')
    refresh()
  }

  function handleAddBall(name, notes) {
    addBall(name, notes)
    syncFromSuggestion()
    setEditIndexState(null)
    setPhase('plan')
    refresh()
  }

  // ── Wipe / restart ─────────────────────────────────────────────────────────

  function handleWipeBall() {
    wipeBallShots()
    syncFromSuggestion()
    setEditIndexState(null)
    setPhase('plan')
    refresh()
  }

  function handleWipeAll() {
    wipeAllShots()
    syncFromSuggestion()
    setEditIndexState(null)
    setPhase('plan')
    refresh()
  }

  function handleRestart() {
    setSessionStarted(false)
    setOverlayOpen(false)
    setPhase('plan')
    setEditIndexState(null)
    setHamburgerOpen(false)
  }

  // ── Export / import (in-session) ───────────────────────────────────────────

  function handleExport() {
    const json     = exportSessionJSON()
    const blob     = new Blob([json], { type: 'application/json' })
    const url      = URL.createObjectURL(blob)
    const date     = new Date().toISOString().slice(0, 10)
    const filename = `lineup-${date}-${CONSTANTS.PATTERN_LENGTH}ft.json`
    const a        = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    setHamburgerOpen(false)
  }

  function handleInSessionImport(json) {
    importSessionJSON(json)
    syncFromSuggestion()
    setEditIndexState(null)
    setPhase('plan')
    setHamburgerOpen(false)
    refresh()
  }

  // ── Share URL copy ─────────────────────────────────────────────────────────

  function handleCopyURL() {
    const url = encodeSessionURL(
      CONSTANTS.PATTERN_LENGTH, CONSTANTS.BALL_TO_SLIDE_FOOT, CONSTANTS.HANDEDNESS)
    navigator.clipboard.writeText(url).catch(() => {})
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const suggestion = State.suggestion
  const shots      = sessionStarted ? getShotHistory()  : []
  const balls      = sessionStarted ? getBalls()        : []

  const sessionInfo = sessionStarted ? {
    patternLength:  CONSTANTS.PATTERN_LENGTH,
    ballToSlide:    CONSTANTS.BALL_TO_SLIDE_FOOT,
    handedness:     CONSTANTS.HANDEDNESS,
    activeBallName: State.activeBall()?.name || '—',
  } : null

  return (
    <div className="flex flex-col h-full">
      {/* ── Setup modal ──────────────────────────────────────────────────── */}
      {!sessionStarted && (
        <SetupModal onStart={handleStart} onImport={handleImportSetup} />
      )}

      {/* ── App shell (hidden until session starts) ───────────────────── */}
      {sessionStarted && (
        <>
          {/* Internal header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-green-400 font-bold text-sm tracking-tight">LineUp</span>
              <span className="text-xs text-slate-500">
                {sessionInfo.patternLength}ft · {sessionInfo.handedness === 'left' ? 'LH' : 'RH'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 truncate max-w-28">{sessionInfo.activeBallName}</span>
              <button
                onClick={handleCopyURL}
                title="Copy share URL"
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                ⬡
              </button>
              <button
                onClick={() => setHamburgerOpen(true)}
                aria-label="Menu"
                className="flex flex-col gap-1 p-1"
              >
                {[0,1,2].map(i => (
                  <span key={i} className="block w-5 h-0.5 bg-slate-400 rounded-full" />
                ))}
              </button>
            </div>
          </div>

          {/* Suggestion row */}
          {suggestion && (
            <div className="flex-shrink-0">
              <SuggestionRow
                suggestion={suggestion}
                isExploration={isExploration}
                onTap={() => setOverlayOpen(v => !v)}
                overlayOpen={overlayOpen}
              />
            </div>
          )}

          {/* History — scrollable middle area */}
          <ShotHistory
            shots={shots}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />

          {/* Slider overlay — fixed-height at the bottom */}
          <div className="flex-shrink-0">
            <SliderOverlay
              open={overlayOpen}
              phase={phase}
              onPhaseChange={handlePhaseChange}
              onRecord={handleRecord}
              editIndex={editIndex}
              planBP={planBP}     setPlanBP={setPlanBP}
              planTarget={planTarget} setPlanTarget={setPlanTarget}
              resFoot={resFoot}   setResFoot={setResFoot}
              resTarget={resTarget} setResTarget={setResTarget}
              resBP={resBP}       setResBP={setResBP}
              resFinish={resFinish} setResFinish={setResFinish}
              planDerived={planDerived}
              expectedBP={expectedBP}
              bpMin={bpMin}
              bpMax={bpMax}
              rtl={rtl}
            />
          </div>
        </>
      )}

      {/* Hamburger menu */}
      <HamburgerMenu
        open={hamburgerOpen}
        onClose={() => setHamburgerOpen(false)}
        onSwitchBall={handleSwitchBall}
        onAddBall={handleAddBall}
        onWipeBall={handleWipeBall}
        onWipeAll={handleWipeAll}
        onRestart={handleRestart}
        onExport={handleExport}
        onImport={handleInSessionImport}
        balls={balls}
      />
    </div>
  )
}
