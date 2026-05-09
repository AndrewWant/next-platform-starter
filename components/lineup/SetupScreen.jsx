'use client';

import { useState } from 'react';

/**
 * Full-page setup screen. Calls onStart(cfg) with:
 *   { patternLength, patternLabel, ballOffset, drift, hand, ballName, ballNotes }
 * Calls onImport(jsonString) when the user imports a saved session.
 */
export default function SetupScreen({ onStart, onImport }) {
  const [patternLength, setPatternLength] = useState(42);
  const [patternLabel,  setPatternLabel]  = useState('');
  const [ballOffset,    setBallOffset]    = useState(5);
  const [drift,         setDrift]         = useState(2);
  const [hand,          setHand]          = useState('R');
  const [ballName,      setBallName]      = useState('');
  const [ballNotes,     setBallNotes]     = useState('');

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const submit = () => onStart({
    patternLength: clamp(parseInt(patternLength, 10) || 42, 20, 60),
    patternLabel:  patternLabel.trim(),
    ballOffset:    clamp(parseFloat(ballOffset)    || 5,  0, 15),
    drift:         clamp(parseFloat(drift)         || 0, -6, 10),
    hand,
    ballName:  ballName.trim()  || 'Ball 1',
    ballNotes: ballNotes.trim(),
  });

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { onImport(ev.target.result); } catch { /* handled upstream */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="lu-setup-root">
      <div className="lu-setup-card">

        {/* Header */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="lu-brand-mark" />
            <span style={{ fontWeight:800, fontSize:15, letterSpacing:'-0.01em', color:'var(--lu-txt)' }}>
              LineUp
            </span>
          </div>
          <span style={{
            fontFamily:"'JetBrains Mono', monospace", fontSize:10, letterSpacing:'0.18em',
            padding:'4px 8px', borderRadius:999, color:'var(--lu-target)',
            border:'1px solid rgba(238,122,46,0.4)', background:'rgba(238,122,46,0.08)',
          }}>
            NEW SESSION
          </span>
        </header>

        <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:'-0.02em', margin:'0 0 6px', color:'var(--lu-txt)' }}>
          Set up your lane read
        </h1>
        <p style={{ color:'var(--lu-txt-2)', fontSize:14, lineHeight:1.45, margin:'0 0 22px' }}>
          Tell me the pattern, your offsets, and which hand you bowl with.
        </p>

        {/* Hand */}
        <section className="lu-setup-section">
          <h2 className="lu-setup-h">Hand</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { k:'R', label:'Right hand', sub:'Board 1 = right gutter' },
              { k:'L', label:'Left hand',  sub:'Board 1 = left gutter'  },
            ].map(o => (
              <button key={o.k} type="button" onClick={() => setHand(o.k)}
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'10px 12px',
                        background: hand === o.k ? 'rgba(238,122,46,0.08)' : 'var(--lu-bg-2)',
                        border: `1px solid ${hand === o.k ? 'rgba(238,122,46,0.65)' : 'var(--lu-line)'}`,
                        borderRadius:10, color:'var(--lu-txt)', textAlign:'left', cursor:'pointer',
                        fontFamily:'inherit', transition:'border-color 0.15s, background 0.15s',
                      }}>
                <span style={{
                  width:30, height:30, borderRadius:8,
                  display:'grid', placeItems:'center',
                  fontFamily:"'JetBrains Mono', monospace", fontWeight:700, fontSize:14,
                  background: hand === o.k ? 'var(--lu-target)' : 'var(--lu-bg-3)',
                  color: hand === o.k ? '#1c0d04' : 'var(--lu-txt-2)',
                }}>
                  {o.k}
                </span>
                <span style={{ display:'flex', flexDirection:'column', lineHeight:1.2 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{o.label}</span>
                  <span style={{ fontSize:10.5, color:'var(--lu-txt-3)', fontFamily:"'JetBrains Mono', monospace", letterSpacing:'0.04em' }}>
                    {o.sub}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Oil pattern */}
        <section className="lu-setup-section">
          <h2 className="lu-setup-h">Oil pattern</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <NumField label="Length" value={patternLength} onChange={setPatternLength}
                      type="number" step={1} min={20} max={60} suffix="ft" />
            <TextField label="Label" value={patternLabel} onChange={setPatternLabel}
                       placeholder={`${patternLength} FT`}
                       hint="Shown on lane (e.g. Kegel — Crown)" />
          </div>
        </section>

        {/* Body */}
        <section className="lu-setup-section">
          <h2 className="lu-setup-h">Body</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <NumField label="Ball offset" value={ballOffset} onChange={setBallOffset}
                      type="number" step={0.5} min={0} max={15} suffix="bds"
                      hint="Slide foot → ball (boards)" />
            <NumField label="Drift" value={drift} onChange={setDrift}
                      type="number" step={0.5} min={-6} max={10} suffix="bds"
                      hint="Away from ball side during approach" />
          </div>
        </section>

        {/* Ball */}
        <section className="lu-setup-section">
          <h2 className="lu-setup-h">Active ball</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <TextField label="Name"  value={ballName}  onChange={setBallName}  placeholder="e.g. Phaze II" />
            <TextField label="Notes" value={ballNotes} onChange={setBallNotes} placeholder="Surface, layout…" />
          </div>
        </section>

        <button className="lu-btn-primary" onClick={submit} style={{ marginTop:6 }}>
          <span>Start session</span>
          <span className="lu-btn-sub">tap lane to plan · record shots after each throw</span>
        </button>

        <p style={{ color:'var(--lu-txt-3)', fontSize:12, lineHeight:1.45, margin:'14px 4px 4px', textAlign:'center' }}>
          Have a saved session?{' '}
          <label style={{ color:'var(--lu-target)', fontWeight:600, cursor:'pointer' }}>
            Import JSON
            <input type="file" accept=".json" style={{ display:'none' }} onChange={handleImport} />
          </label>
        </p>

      </div>
    </div>
  );
}

function NumField({ label, value, onChange, type = 'number', step, min, max, suffix, hint }) {
  return (
    <label className="lu-field">
      <span className="lu-field-label">{label}</span>
      <span className="lu-field-input">
        <input type={type} value={value} step={step} min={min} max={max}
               onChange={e => onChange(e.target.value)} />
        {suffix && <span className="lu-field-suffix">{suffix}</span>}
      </span>
      {hint && <span className="lu-field-hint">{hint}</span>}
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, hint }) {
  return (
    <label className="lu-field">
      <span className="lu-field-label">{label}</span>
      <span className="lu-field-input">
        <input type="text" value={value} placeholder={placeholder}
               onChange={e => onChange(e.target.value)} />
      </span>
      {hint && <span className="lu-field-hint">{hint}</span>}
    </label>
  );
}
