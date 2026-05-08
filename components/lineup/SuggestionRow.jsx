'use client'

export default function SuggestionRow({ suggestion, isExploration, onTap, overlayOpen }) {
  if (!suggestion) return null

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 text-left focus:outline-none active:bg-slate-800 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold tracking-wider uppercase ${isExploration ? 'text-amber-400' : 'text-green-400'}`}>
          {isExploration ? 'Explore inside →' : 'Suggested line'}
        </span>
        <span className="text-xs text-slate-500">{overlayOpen ? 'tap to close' : 'tap to adjust'}</span>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {[
          { label: 'Foot',   value: suggestion.foot },
          { label: 'Start',  value: suggestion.ballStart },
          { label: 'Target', value: suggestion.target },
          { label: 'BP',     value: suggestion.breakpoint },
          { label: 'Finish', value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-lg font-mono font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
    </button>
  )
}
