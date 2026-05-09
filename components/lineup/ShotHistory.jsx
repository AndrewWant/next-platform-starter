'use client'

import { useRef } from 'react'

function ShotRow({ shot, onEdit, onRemove }) {
  const timerRef = useRef(null)
  const rowRef   = useRef(null)

  function startPress() {
    timerRef.current = setTimeout(() => {
      rowRef.current?.classList.add('ring-1', 'ring-amber-500/50')
      rowRef.current?.querySelector('.edit-controls')?.classList.remove('hidden')
    }, 600)
  }

  function cancelPress() {
    clearTimeout(timerRef.current)
  }

  function dismissControls() {
    rowRef.current?.classList.remove('ring-1', 'ring-amber-500/50')
    rowRef.current?.querySelector('.edit-controls')?.classList.add('hidden')
  }

  return (
    <div
      ref={rowRef}
      className="bg-slate-900 rounded-xl px-4 py-3 space-y-2 select-none"
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold text-slate-500 tabular-nums">#{shot.shotNumber}</span>
        <span className="text-xs text-slate-600 ml-auto">hold to edit</span>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {[
          { label: 'Foot',   value: shot.foot },
          { label: 'Start',  value: shot.ballStart },
          { label: 'Target', value: shot.target },
          { label: 'BP',     value: shot.breakpoint },
          { label: 'Finish', value: shot.finishPosition },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
            <div className="text-base font-mono font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Boards crossed: <span className="text-slate-300 font-mono">{shot.boardsCrossed}</span>
        </span>
      </div>

      <div className="edit-controls hidden flex gap-2 pt-1 border-t border-slate-800">
        <button
          onClick={e => { e.stopPropagation(); onEdit(shot.index); dismissControls() }}
          className="flex-1 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(shot.index); dismissControls() }}
          className="flex-1 py-1.5 text-xs font-semibold bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded-lg transition-colors"
        >
          Remove
        </button>
        <button
          onClick={e => { e.stopPropagation(); dismissControls() }}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-400 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ShotHistory({ shots, onEdit, onRemove }) {
  if (shots.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-16 px-6">
          <div className="text-4xl mb-3">🎳</div>
          <p className="text-slate-500 text-sm">No shots recorded yet.</p>
          <p className="text-slate-600 text-xs mt-1">Plan your line, then record the result.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      {shots.map(shot => (
        <ShotRow
          key={`${shot.index}-${shot.shotNumber}`}
          shot={shot}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
