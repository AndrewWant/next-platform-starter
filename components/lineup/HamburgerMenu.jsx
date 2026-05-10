'use client';

import { useState } from 'react';

const S = {
  menuBody: { display:'flex', flexDirection:'column', gap:16 },
  secHead: {
    fontFamily:"'JetBrains Mono', monospace", fontSize:11, letterSpacing:'0.14em',
    fontWeight:600, color:'var(--lu-txt-3)', textTransform:'uppercase', margin:'0 0 8px',
  },
  ballList: { listStyle:'none', padding:0, margin:'0 0 8px', display:'flex', flexDirection:'column', gap:4 },
  ballBtn: (active) => ({
    width:'100%', background: active ? 'rgba(238,122,46,0.06)' : 'var(--lu-bg-2)',
    border: `1px solid ${active ? 'rgba(238,122,46,0.55)' : 'var(--lu-line)'}`,
    color:'var(--lu-txt)', padding:'9px 10px', borderRadius:9,
    display:'grid', gridTemplateColumns:'14px 1fr auto', gap:10,
    alignItems:'center', textAlign:'left', cursor:'pointer', fontFamily:'inherit',
    transition:'border-color 0.15s, background 0.15s',
  }),
  dot: (active) => ({
    width:10, height:10, borderRadius:'50%',
    background: active ? 'var(--lu-target)' : 'var(--lu-bg-3)',
  }),
  menuBtn: (danger) => ({
    width:'100%',
    background: danger ? 'rgba(216,80,76,0.06)' : 'var(--lu-bg-2)',
    border: `1px solid ${danger ? 'rgba(216,80,76,0.3)' : 'var(--lu-line)'}`,
    color: danger ? 'var(--lu-danger)' : 'var(--lu-txt)',
    fontSize:13, fontWeight:500, padding:'10px 12px', borderRadius:9,
    marginBottom:6, textAlign:'left', cursor:'pointer', fontFamily:'inherit',
  }),
  toggleRow: (on) => ({
    display:'flex', alignItems:'center', justifyContent:'space-between',
    width:'100%', background:'transparent', border:'none', color:'var(--lu-txt)',
    fontSize:13, padding:'9px 2px',
    borderBottom:'1px solid var(--lu-line)', textAlign:'left',
    cursor:'pointer', fontFamily:'inherit',
  }),
  linkBtn: {
    background:'transparent', border:'none', color:'var(--lu-target)',
    fontWeight:600, fontSize:12.5, padding:'6px 0', cursor:'pointer', fontFamily:'inherit',
  },
};

function Toggle({ on }) {
  return (
    <span style={{
      width:34, height:20, borderRadius:999, position:'relative', flexShrink:0,
      background: on ? 'rgba(238,122,46,0.6)' : 'var(--lu-bg-3)',
      transition:'background 0.15s', display:'inline-block',
    }}>
      <span style={{
        position:'absolute', top:2, left:2,
        width:16, height:16, borderRadius:'50%',
        background: on ? '#ffe2cb' : 'var(--lu-txt-2)',
        transform: on ? 'translateX(14px)' : 'none',
        transition:'transform 0.18s ease, background 0.15s',
      }} />
    </span>
  );
}

function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ padding:'8px 2px', borderBottom:'1px solid var(--lu-line)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--lu-txt)', marginBottom:6 }}>
        <span>{label}</span>
        <span style={{ fontFamily:"'JetBrains Mono', monospace", color:'var(--lu-txt-2)', fontSize:12 }}>
          {value.toFixed(1)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))}
             style={{ width:'100%', accentColor:'var(--lu-target)' }} />
    </div>
  );
}

/**
 * Left-side menu drawer.
 *
 * Props:
 *   balls        — from getBalls()
 *   tweaks       — { showPinNumbers, showPath, showApproachDots, markerContrast }
 *   setTweak     — (key, value) => void
 *   onSwitchBall — (ballId) => void
 *   onAddBall    — (name, notes) => void
 *   onWipeBall   — () => void
 *   onWipeAll    — () => void
 *   onRestart    — () => void
 *   onExport     — () => void
 *   onImport     — (jsonString) => void
 *   onClose      — () => void
 */
export default function HamburgerMenu({
  balls, tweaks, setTweak,
  onSwitchBall, onAddBall,
  onWipeBall, onWipeAll, onRestart,
  onExport, onImport,
  onViewSessions,
  onClose,
}) {
  const [adding,   setAdding]   = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newNotes, setNewNotes] = useState('');

  const submitBall = () => {
    if (!newName.trim()) return;
    onAddBall(newName.trim(), newNotes.trim());
    setNewName(''); setNewNotes(''); setAdding(false);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { onImport(ev.target.result); onClose(); } catch {} };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={S.menuBody}>

      {/* Balls */}
      <section>
        <h4 style={S.secHead}>Balls</h4>
        <ul style={S.ballList}>
          {balls.map(b => (
            <li key={b.ballId}>
              <button style={S.ballBtn(b.active)} onClick={() => { onSwitchBall(b.ballId); onClose(); }}>
                <span style={S.dot(b.active)} />
                <span style={{ display:'flex', flexDirection:'column', lineHeight:1.2, minWidth:0 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{b.name}</span>
                  {b.notes && (
                    <span style={{ fontSize:11, color:'var(--lu-txt-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {b.notes}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'var(--lu-txt-3)' }}>
                  {b.shotCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!adding ? (
          <button style={S.linkBtn} onClick={() => setAdding(true)}>+ Add ball</button>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, background:'var(--lu-bg-2)', border:'1px solid var(--lu-line)', borderRadius:9, padding:8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
                   placeholder="Name (e.g. Solid)"
                   style={{ background:'var(--lu-bg-1)', border:'1px solid var(--lu-line)', color:'var(--lu-txt)', borderRadius:7, padding:'7px 9px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
                   placeholder="Notes (optional)"
                   style={{ background:'var(--lu-bg-1)', border:'1px solid var(--lu-line)', color:'var(--lu-txt)', borderRadius:7, padding:'7px 9px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center' }}>
              <button style={S.linkBtn} onClick={() => setAdding(false)}>Cancel</button>
              <button className="lu-btn-primary" onClick={submitBall}
                      style={{ width:'auto', padding:'8px 12px', fontSize:12.5 }}>Add</button>
            </div>
          </div>
        )}
      </section>

      {/* Display */}
      <section>
        <h4 style={S.secHead}>Display</h4>
        <button style={S.toggleRow(tweaks.showPinNumbers)}
                onClick={() => setTweak('showPinNumbers', !tweaks.showPinNumbers)}>
          <span>Show pin numbers</span>
          <Toggle on={tweaks.showPinNumbers} />
        </button>
        <button style={S.toggleRow(tweaks.showPath)}
                onClick={() => setTweak('showPath', !tweaks.showPath)}>
          <span>Show ball path</span>
          <Toggle on={tweaks.showPath} />
        </button>
        <button style={{ ...S.toggleRow(tweaks.showApproachDots), borderBottom:'none' }}
                onClick={() => setTweak('showApproachDots', !tweaks.showApproachDots)}>
          <span>Show approach dots</span>
          <Toggle on={tweaks.showApproachDots} />
        </button>
        <SliderRow label="Marker board contrast" value={tweaks.markerContrast}
                   min={0} max={1} step={0.1}
                   onChange={v => setTweak('markerContrast', v)} />
      </section>

      {/* Session */}
      <section>
        <h4 style={S.secHead}>Session</h4>
        <button style={S.menuBtn(false)} onClick={() => { onClose(); onViewSessions?.(); }}>
          Past sessions
        </button>
        <button style={S.menuBtn(false)} onClick={() => { onExport(); onClose(); }}>
          Export session JSON
        </button>
        <label style={{ ...S.menuBtn(false), display:'block', cursor:'pointer' }}>
          Import session JSON
          <input type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
        </label>
        <button style={S.menuBtn(false)} onClick={() => { if (confirm('Wipe shots for this ball?')) { onWipeBall(); onClose(); } }}>
          Wipe shots for this ball
        </button>
        <button style={S.menuBtn(false)} onClick={() => { if (confirm('Wipe ALL shots?')) { onWipeAll(); onClose(); } }}>
          Wipe all shots
        </button>
        <button style={S.menuBtn(true)} onClick={() => { if (confirm('End session and start over?')) { onRestart(); onClose(); } }}>
          End session &amp; restart
        </button>
      </section>

    </div>
  );
}
