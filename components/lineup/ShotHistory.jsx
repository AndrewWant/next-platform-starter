'use client';

const POCKET = 17;

/**
 * Shot history list for the drawer.
 * shots = array from getShotHistory():
 *   { shotNumber, actual: {foot,target,brk,finish,boardsCrossed}, planned, index }
 */
export default function ShotHistory({ shots, onEdit, onRemove }) {
  if (!shots.length) {
    return (
      <div style={{ textAlign:'center', padding:'30px 10px', color:'var(--lu-txt-2)', fontSize:13.5, lineHeight:1.5 }}>
        <p>No shots recorded yet.</p>
        <p style={{ color:'var(--lu-txt-3)', marginTop:4, fontSize:12 }}>
          Switch to <strong style={{ color:'var(--lu-target)' }}>Record</strong>,
          set foot · target · BP · finish, then save.
        </p>
      </div>
    );
  }

  return (
    <ol style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
      {shots.map(shot => {
        const { actual, planned, shotNumber, index } = shot;
        const miss = actual.finish - POCKET;
        return (
          <li key={index} style={{
            background:'var(--lu-bg-2)', border:'1px solid var(--lu-line)',
            borderRadius:10, overflow:'hidden',
          }}>
            {/* Actual row — tap to edit */}
            <button onClick={() => onEdit(index)} style={{
              width:'100%', background:'transparent', border:'none', color:'var(--lu-txt)',
              display:'grid', gridTemplateColumns:'28px 1fr auto',
              alignItems:'center', gap:6, padding:'8px 4px 6px 8px',
              textAlign:'left', cursor:'pointer', fontFamily:'inherit',
            }}>
              <span style={{
                fontFamily:"'JetBrains Mono', monospace",
                fontSize:11, color:'var(--lu-txt-3)', fontWeight:600,
              }}>
                #{shotNumber}
              </span>

              <span style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, minWidth:0 }}>
                <ShotCell value={actual.foot}   label="foot" color="var(--lu-stance)" />
                <ShotCell value={actual.target} label="tgt"  color="var(--lu-target)" />
                <ShotCell value={actual.brk}    label="bp"   color="var(--lu-brk)"    />
                <ShotCell value={actual.finish} label="fin"  color="var(--lu-finish)" />
              </span>

              <MissBadge miss={miss} />
            </button>

            {/* Planned row — dimmed, shown if planned data exists */}
            {planned && (
              <div style={{
                display:'grid', gridTemplateColumns:'28px 1fr auto',
                alignItems:'center', gap:6,
                padding:'0 4px 6px 8px',
                borderTop:'1px solid var(--lu-line)',
              }}>
                <span style={{
                  fontFamily:"'JetBrains Mono', monospace", fontSize:9,
                  color:'var(--lu-txt-3)', letterSpacing:'0.06em',
                }}>
                  plan
                </span>
                <span style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, opacity:0.55 }}>
                  <ShotCell value={planned.foot}   label="foot" color="var(--lu-stance)" small />
                  <ShotCell value={planned.target} label="tgt"  color="var(--lu-target)" small />
                  <ShotCell value={planned.brk}    label="bp"   color="var(--lu-brk)"    small />
                  <ShotCell value={planned.finish} label="fin"  color="var(--lu-finish)" small />
                </span>
                <button onClick={() => onRemove(index)} aria-label="Remove shot" style={{
                  background:'transparent', border:'none', color:'var(--lu-txt-3)',
                  fontSize:18, width:30, cursor:'pointer', fontFamily:'inherit',
                }}>
                  ×
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ShotCell({ value, label, color, small }) {
  return (
    <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.1, minWidth:0 }}>
      <b style={{
        fontFamily:"'JetBrains Mono', monospace",
        fontSize: small ? 11 : 14, fontWeight:700, color,
      }}>
        {value ?? '—'}
      </b>
      <span style={{
        fontSize:9.5, color:'var(--lu-txt-3)',
        fontFamily:"'JetBrains Mono', monospace", letterSpacing:'0.04em',
      }}>
        {label}
      </span>
    </span>
  );
}

function MissBadge({ miss }) {
  const isPocket = miss === 0;
  const isHigh   = miss > 0;
  const style = isPocket
    ? { color:'#1c0e02', background:'var(--lu-finish)', border:'none' }
    : isHigh
      ? { color:'var(--lu-brk)',    background:'rgba(58,134,212,0.12)', border:'1px solid rgba(58,134,212,0.3)' }
      : { color:'var(--lu-target)', background:'rgba(238,122,46,0.12)', border:'1px solid rgba(238,122,46,0.3)' };
  return (
    <span style={{
      fontFamily:"'JetBrains Mono', monospace", fontSize:10, fontWeight:700, letterSpacing:'0.06em',
      padding:'4px 6px', borderRadius:5, whiteSpace:'nowrap', ...style,
    }}>
      {isPocket ? 'POCKET' : (isHigh ? `+${miss}` : `${miss}`)}
    </span>
  );
}
