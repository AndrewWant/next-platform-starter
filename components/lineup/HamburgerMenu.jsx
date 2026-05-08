'use client'

import { useRef, useState } from 'react'
import { State } from '../../lib/lineup/state'

function ConfirmRow({ label, onConfirm, onCancel, danger = false }) {
  return (
    <div className="flex gap-2 mt-1">
      <button
        onClick={onConfirm}
        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          danger
            ? 'bg-red-900/50 hover:bg-red-800/50 text-red-300'
            : 'bg-slate-700 hover:bg-slate-600 text-white'
        }`}
      >
        {label}
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg"
      >
        Cancel
      </button>
    </div>
  )
}

export default function HamburgerMenu({
  open,
  onClose,
  onSwitchBall,
  onAddBall,
  onWipeBall,
  onWipeAll,
  onRestart,
  onExport,
  onImport,
  balls,
}) {
  const [confirm, setConfirm] = useState(null)  // 'wipe-ball' | 'wipe-all' | 'restart'
  const [addOpen, setAddOpen] = useState(false)
  const [editingBall, setEditingBall] = useState(null)
  const importRef = useRef(null)

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { onImport(ev.target.result) }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleBallSave(ballId, name, notes) {
    const ball = State.session?.balls.find(b => b.ballId === ballId)
    if (ball) { ball.name = name; ball.notes = notes }
    setEditingBall(null)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <span className="font-semibold text-white">Menu</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 px-4 py-4 space-y-6">
          {/* Ball list */}
          <section>
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Balls</h3>
            <div className="space-y-1">
              {balls.map(ball => (
                <div key={ball.ballId}>
                  {editingBall === ball.ballId ? (
                    <BallEditForm
                      ball={ball}
                      onSave={(name, notes) => handleBallSave(ball.ballId, name, notes)}
                      onCancel={() => setEditingBall(null)}
                    />
                  ) : (
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        ball.active
                          ? 'bg-green-900/30 border border-green-500/30'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                      onClick={() => { if (!ball.active) { onSwitchBall(ball.ballId); onClose() } }}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ball.active ? 'bg-green-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{ball.name}</div>
                        {ball.notes && <div className="text-xs text-slate-500 truncate">{ball.notes}</div>}
                      </div>
                      <div className="text-xs text-slate-500 flex-shrink-0">{ball.shotCount}sh</div>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingBall(ball.ballId) }}
                        className="text-slate-500 hover:text-white text-sm"
                        aria-label="Edit ball"
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add ball */}
            <button
              onClick={() => setAddOpen(v => !v)}
              className="mt-2 w-full text-sm text-slate-400 hover:text-white py-2 transition-colors"
            >
              + Add ball
            </button>
            {addOpen && (
              <AddBallForm
                onAdd={(name, notes) => { onAddBall(name, notes); setAddOpen(false); onClose() }}
                onCancel={() => setAddOpen(false)}
              />
            )}
          </section>

          {/* Session actions */}
          <section>
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Session</h3>
            <div className="space-y-1">
              <button onClick={onExport} className="menu-item">Export JSON</button>
              <button onClick={() => importRef.current?.click()} className="menu-item">Import JSON</button>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

              {confirm === 'wipe-ball' ? (
                <ConfirmRow
                  label="Wipe this ball's shots"
                  danger
                  onConfirm={() => { onWipeBall(); setConfirm(null); onClose() }}
                  onCancel={() => setConfirm(null)}
                />
              ) : (
                <button onClick={() => setConfirm('wipe-ball')} className="menu-item text-red-400">Wipe ball shots</button>
              )}

              {confirm === 'wipe-all' ? (
                <ConfirmRow
                  label="Wipe ALL shots"
                  danger
                  onConfirm={() => { onWipeAll(); setConfirm(null); onClose() }}
                  onCancel={() => setConfirm(null)}
                />
              ) : (
                <button onClick={() => setConfirm('wipe-all')} className="menu-item text-red-400">Wipe all shots</button>
              )}

              {confirm === 'restart' ? (
                <ConfirmRow
                  label="Restart (new setup)"
                  onConfirm={() => { onRestart(); setConfirm(null); onClose() }}
                  onCancel={() => setConfirm(null)}
                />
              ) : (
                <button onClick={() => setConfirm('restart')} className="menu-item">New session</button>
              )}
            </div>
          </section>
        </div>

        {/* Sign out */}
        <div className="border-t border-slate-800 p-4">
          <form action="/auth/signout" method="post">
            <button type="submit" className="w-full text-sm text-slate-400 hover:text-white py-2 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

function AddBallForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <div className="bg-slate-800 rounded-xl p-3 space-y-2 mt-1">
      <input
        type="text"
        placeholder="Ball name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white border border-slate-600 focus:border-green-400 focus:outline-none"
        autoFocus
      />
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white border border-slate-600 focus:border-green-400 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onAdd(name.trim() || 'Default Ball', notes.trim())}
          className="flex-1 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-500 text-white rounded-lg"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs bg-slate-700 text-slate-400 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function BallEditForm({ ball, onSave, onCancel }) {
  const [name, setName] = useState(ball.name)
  const [notes, setNotes] = useState(ball.notes || '')
  return (
    <div className="bg-slate-800 rounded-xl p-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white border border-slate-600 focus:border-green-400 focus:outline-none"
        autoFocus
      />
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes..."
        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white border border-slate-600 focus:border-green-400 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(name.trim() || 'Default Ball', notes.trim())}
          className="flex-1 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-500 text-white rounded-lg"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs bg-slate-700 text-slate-400 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
