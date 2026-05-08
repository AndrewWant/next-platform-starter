'use client'

import { useState, useRef } from 'react'

export default function SetupModal({ onStart, onImport }) {
  const [hand, setHand] = useState('right')
  const [error, setError] = useState('')
  const importRef = useRef(null)

  function handleStart(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const pl  = parseInt(fd.get('patternLength'), 10)
    const bsf = parseInt(fd.get('ballToSlideFoot'), 10)
    if (isNaN(pl) || isNaN(bsf) || pl < 20 || pl > 60 || bsf < 1 || bsf > 15) {
      setError('Enter valid numbers: pattern length 20–60 ft, ball offset 1–15 boards.')
      return
    }
    const ballName  = (fd.get('ballName')  || '').trim() || 'Default Ball'
    const ballNotes = (fd.get('ballNotes') || '').trim()
    setError('')
    onStart(pl, bsf, hand, ballName, ballNotes)
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        onImport(ev.target.result)
        setError('')
      } catch {
        setError('Could not import — invalid or corrupted file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div>
          <h1 className="text-xl font-bold text-green-400 tracking-tight">LineUp</h1>
          <p className="text-sm text-slate-400 mt-0.5">Lane read tool for tenpin bowling</p>
        </div>

        <form onSubmit={handleStart} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pattern length (ft)</label>
              <input
                name="patternLength"
                type="number"
                inputMode="numeric"
                defaultValue={42}
                className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-lg font-mono text-center text-white border border-slate-700 focus:border-green-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ball offset (boards)</label>
              <input
                name="ballToSlideFoot"
                type="number"
                inputMode="numeric"
                defaultValue={5}
                className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-lg font-mono text-center text-white border border-slate-700 focus:border-green-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Handedness</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              {['right', 'left'].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHand(h)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    hand === h ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {h.charAt(0).toUpperCase() + h.slice(1)}-handed
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Ball name</label>
            <input
              name="ballName"
              type="text"
              placeholder="e.g. Storm Phaze II"
              className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-white border border-slate-700 focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Ball notes (optional)</label>
            <input
              name="ballNotes"
              type="text"
              placeholder="Surface, layout..."
              className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-white border border-slate-700 focus:border-green-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Start session
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-1"
          >
            Import saved session…
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
    </div>
  )
}
