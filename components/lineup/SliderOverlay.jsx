'use client'

import { LaneRead } from '../../lib/lineup/models'
import { CONSTANTS } from '../../lib/lineup/constants'

function BoardSlider({ value, onChange, className = '', result = false, rtl = false }) {
  return (
    <input
      type="range"
      min={1}
      max={39}
      value={value}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      className={`lineup-slider ${result ? 'lineup-slider-result' : ''} ${rtl ? 'slider-rtl' : ''} ${className}`}
    />
  )
}

function FootSlider({ value, onChange, rtl = false }) {
  return (
    <input
      type="range"
      min={1}
      max={50}
      value={value}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      className={`lineup-slider lineup-slider-result ${rtl ? 'slider-rtl' : ''}`}
    />
  )
}

function BreakpointSlider({ value, onChange, min, max, expectedBP, rtl = false }) {
  const range = max - min
  const rawPct = range > 0 ? ((expectedBP - min) / range) * 100 : 50
  const tickPct = rtl ? (100 - rawPct) : rawPct

  return (
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className={`lineup-slider lineup-slider-result w-full ${rtl ? 'slider-rtl' : ''}`}
      />
      {/* Tick mark showing expected (geometric) breakpoint */}
      <div
        className="absolute top-0 w-0.5 h-3 bg-amber-300/60 pointer-events-none"
        style={{ left: `${tickPct}%`, transform: 'translateX(-50%)' }}
        title={`Expected: ${expectedBP}`}
      />
    </div>
  )
}

function SliderRow({ label, value, display, children }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-xl font-mono font-bold text-white">{display ?? value}</span>
      </div>
      {children}
    </div>
  )
}

export default function SliderOverlay({
  open,
  phase,
  onPhaseChange,
  onRecord,
  editIndex,
  // Plan sliders
  planBP, setPlanBP,
  planTarget, setPlanTarget,
  // Result sliders
  resFoot, setResFoot,
  resTarget, setResTarget,
  resBP, setResBP,
  resFinish, setResFinish,
  // Derived
  planDerived,
  expectedBP,
  bpMin,
  bpMax,
  // Handedness
  rtl,
}) {
  if (!open) return null

  const editing = editIndex !== null && editIndex !== undefined
  const recordLabel = editing ? 'Save edit' : 'Record shot'

  return (
    <div className="flex flex-col bg-slate-900 border-t border-slate-800 shadow-2xl">
      {/* Phase tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => onPhaseChange('plan')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            phase === 'plan'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Plan shot
        </button>
        <button
          onClick={() => onPhaseChange('result')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            phase === 'result'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {editing ? `Editing #${editIndex + 1}` : 'Record result'}
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {phase === 'plan' ? (
          <>
            <SliderRow label="Breakpoint" value={planBP}>
              <BoardSlider value={planBP} onChange={setPlanBP} rtl={rtl} />
            </SliderRow>

            <SliderRow label="Target" value={planTarget}>
              <BoardSlider value={planTarget} onChange={setPlanTarget} rtl={rtl} />
            </SliderRow>

            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-800">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Ball start</div>
                <div className="text-2xl font-mono font-bold text-white">{planDerived.ballStart}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Foot</div>
                <div className="text-2xl font-mono font-bold text-white">{planDerived.foot}</div>
              </div>
            </div>

            <button
              disabled
              className="w-full py-3 rounded-xl text-sm font-semibold bg-slate-800 text-slate-600 cursor-default"
            >
              Switch to Result to record →
            </button>
          </>
        ) : (
          <>
            <SliderRow label="Foot" value={resFoot}>
              <FootSlider value={resFoot} onChange={setResFoot} rtl={rtl} />
            </SliderRow>

            <SliderRow label="Target" value={resTarget}>
              <BoardSlider value={resTarget} onChange={setResTarget} result rtl={rtl} />
            </SliderRow>

            <SliderRow
              label={`Breakpoint (expected ${expectedBP})`}
              value={resBP}
            >
              <BreakpointSlider
                value={resBP}
                onChange={setResBP}
                min={bpMin}
                max={bpMax}
                expectedBP={expectedBP}
                rtl={rtl}
              />
            </SliderRow>

            <SliderRow label="Finish position" value={resFinish}>
              <BoardSlider value={resFinish} onChange={setResFinish} result rtl={rtl} />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>{rtl ? '39' : '1'}</span>
                <span className="text-amber-500/60">pocket 17</span>
                <span>{rtl ? '1' : '39'}</span>
              </div>
            </SliderRow>

            <button
              onClick={onRecord}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors"
            >
              {recordLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
