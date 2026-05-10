'use client';

import { useState, useEffect } from 'react';
import { getSessions, getSessionDetail } from '../../app/app/lineup/actions';
import Lane from './Lane';
import ShotHistory from './ShotHistory';

const POCKET = 17;

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}

export default function SessionReview() {
  const [view,     setView]     = useState('list');   // 'list' | 'detail'
  const [sessions, setSessions] = useState(null);     // null = loading
  const [detail,   setDetail]   = useState(null);     // null = loading/none

  useEffect(() => {
    getSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  const openSession = (id) => {
    setView('detail');
    setDetail(null);
    getSessionDetail(id).then(setDetail).catch(() => setDetail({ error: true }));
  };

  if (view === 'list') {
    return <ListView sessions={sessions} onOpen={openSession} />;
  }
  return <DetailView detail={detail} onBack={() => { setView('list'); setDetail(null); }} />;
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ sessions, onOpen }) {
  if (sessions === null) {
    return <Spinner />;
  }
  if (!sessions.length) {
    return (
      <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--lu-txt-2)', fontSize:13.5, lineHeight:1.6 }}>
        <p>No sessions recorded yet.</p>
        <p style={{ color:'var(--lu-txt-3)', fontSize:12, marginTop:4 }}>
          Sessions are saved when you start a new session while signed in.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {sessions.map(s => (
        <div key={s.id} style={{
          background:'var(--lu-bg-2)', border:'1px solid var(--lu-line)',
          borderRadius:10, padding:'10px 12px',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--lu-txt)', lineHeight:1.2 }}>
              {s.pattern_label
                ? `${s.pattern_label} (${s.pattern_length} ft)`
                : `${s.pattern_length} ft · ${s.hand}H`}
            </div>
            {s.ball_names && (
              <div style={{
                fontSize:11.5, color:'var(--lu-txt-3)', marginTop:2,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>
                {s.ball_names}
              </div>
            )}
            <div style={{
              display:'flex', gap:8, marginTop:4, alignItems:'center',
              fontFamily:"'JetBrains Mono', monospace", fontSize:10.5,
            }}>
              <span style={{ color:'var(--lu-txt-3)' }}>{fmt(s.created_at)}</span>
              <span style={{
                color:'var(--lu-txt-2)', background:'var(--lu-bg-3)',
                border:'1px solid var(--lu-line)', borderRadius:4, padding:'1px 5px',
              }}>
                {s.shot_count} shot{s.shot_count !== 1 ? 's' : ''}
              </span>
              {s.pattern_label && (
                <span style={{ color:'var(--lu-txt-3)' }}>{s.hand}H</span>
              )}
            </div>
          </div>
          <button onClick={() => onOpen(s.id)} style={{
            background:'var(--lu-bg-3)', border:'1px solid var(--lu-line)', borderRadius:8,
            color:'var(--lu-txt-2)', padding:'7px 10px', cursor:'pointer',
            fontFamily:'inherit', fontSize:12, whiteSpace:'nowrap',
          }}>
            View →
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({ detail, onBack }) {
  if (!detail) return <Spinner />;
  if (detail.error) {
    return (
      <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--lu-txt-2)' }}>
        Failed to load session.
      </div>
    );
  }

  const { session, shots } = detail;

  // Map DB shots to the shape Lane (reviewShots) and ShotHistory expect
  const reviewShots = shots.map(s => ({
    actual_foot:       s.actual_foot,
    actual_target:     s.actual_target,
    actual_breakpoint: s.actual_brk,
    actual_finish:     s.actual_finish,
  }));

  const mappedShots = shots.map((s, i) => ({
    index:      i,
    shotNumber: s.shot_number,
    planned:    s.planned_foot != null
      ? { foot: s.planned_foot, target: s.planned_target, brk: s.planned_brk, finish: POCKET }
      : null,
    actual: {
      foot:   s.actual_foot,
      target: s.actual_target,
      brk:    s.actual_brk,
      finish: s.actual_finish,
      boardsCrossed: null,
    },
  }));

  // Stats
  const n          = shots.length;
  const pocketHits = shots.filter(s => Math.abs(s.actual_finish - POCKET) <= 1).length;
  const pocketPct  = n ? Math.round(pocketHits / n * 100) : 0;
  const avgMiss    = n
    ? (shots.reduce((a, s) => a + (s.actual_finish - POCKET), 0) / n).toFixed(1)
    : '—';

  const reviewSession = {
    hand:          session.hand,          // already normalised to 'R'/'L' by getSessionDetail
    patternLength: session.pattern_length,
    patternLabel:  session.pattern_label || '',
    ballOffset:    session.ball_to_slide_foot ?? 5,
    drift:         session.drift ?? 0,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Back + header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onBack} style={{
          background:'none', border:'none', color:'var(--lu-target)',
          fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          padding:'4px 0', flexShrink:0,
        }}>
          ← Back
        </button>
        <div style={{ minWidth:0 }}>
          <div style={{
            fontWeight:700, fontSize:13, color:'var(--lu-txt)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {session.pattern_label
              ? `${session.pattern_label} (${session.pattern_length} ft)`
              : `${session.pattern_length} ft`}
          </div>
          <div style={{
            fontFamily:"'JetBrains Mono', monospace", fontSize:10.5, color:'var(--lu-txt-3)',
          }}>
            {fmt(session.created_at)} · {session.hand}H
          </div>
        </div>
      </div>

      {/* Lane diagram */}
      <div style={{ width:'100%', maxHeight:320, overflow:'hidden', borderRadius:10,
                    border:'1px solid var(--lu-line)' }}>
        <Lane
          session={reviewSession}
          plan={null}
          result={null}
          mode="plan"
          on={{ foot:()=>{}, target:()=>{}, brk:()=>{}, finish:()=>{} }}
          tweaks={{ showPinNumbers:true, showPath:false, showApproachDots:false, markerContrast:0.4 }}
          reviewShots={reviewShots}
        />
      </div>

      {/* Stats strip */}
      {n > 0 && (
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6,
          background:'var(--lu-bg-2)', border:'1px solid var(--lu-line)', borderRadius:10, padding:'10px 12px',
        }}>
          <Stat label="Shots" value={n} />
          <Stat label="Pocket %" value={`${pocketPct}%`} color="var(--lu-stance)" />
          <Stat label="Avg miss" value={parseFloat(avgMiss) >= 0 ? `+${avgMiss}` : avgMiss}
                color={parseFloat(avgMiss) === 0 ? 'var(--lu-stance)' : 'var(--lu-txt-2)'} />
        </div>
      )}

      {/* Shot list (read-only) */}
      <ShotHistory shots={mappedShots} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <span style={{
        fontFamily:"'JetBrains Mono', monospace", fontSize:18, fontWeight:700,
        color: color ?? 'var(--lu-txt)',
      }}>
        {value}
      </span>
      <span style={{ fontSize:10, color:'var(--lu-txt-3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--lu-txt-3)', fontSize:13 }}>
      Loading…
    </div>
  );
}
