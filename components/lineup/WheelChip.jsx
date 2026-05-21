'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// px of accumulated scroll before a value step triggers
const WHEEL_THRESH = 40;
// px of finger drag before a value step triggers
const TOUCH_THRESH = 20;
// momentum deceleration multiplier per ~16ms frame
const DECEL = 0.93;
// px/ms — below this momentum stops
const MIN_VEL = 0.05;
// px/ms — minimum release velocity to trigger momentum at all
const VEL_THRESH = 0.15;
// height of each wheel slot in px (must match CSS)
const ITEM_H = 24;

const clampVal = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export default function WheelChip({ color, label, value, onChange, min = 1, max = 39, value2 }) {
  const trackRef     = useRef(null);
  const wheelAccum   = useRef(0);
  const touchState   = useRef(null);  // { y, acc, history: [{y, t}] }
  const rafRef       = useRef(null);  // momentum requestAnimationFrame id
  const momAccum     = useRef(0);     // sub-ITEM_H momentum remainder
  const animTimer    = useRef(null);
  const didTouch     = useRef(false); // suppress synthetic click after touch
  const [anim, setAnim] = useState({ dir: 0, id: 0 });

  // Uses functional update so nudge never captures stale `value` from closure.
  const nudge = useCallback((delta, fromMomentum = false) => {
    onChange(prev => {
      const v = (prev == null ? min : prev);
      return clampVal(v + delta, min, max);
    });
    if (!fromMomentum) {
      if (animTimer.current) clearTimeout(animTimer.current);
      setAnim(a => ({ dir: delta > 0 ? 1 : -1, id: a.id + 1 }));
      animTimer.current = setTimeout(() => setAnim(a => ({ ...a, dir: 0 })), 160);
    }
  }, [onChange, min, max]);

  const cancelMomentum = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      wheelAccum.current += e.deltaY;
      while (wheelAccum.current >=  WHEEL_THRESH) { nudge(+1); wheelAccum.current -= WHEEL_THRESH; }
      while (wheelAccum.current <= -WHEEL_THRESH) { nudge(-1); wheelAccum.current += WHEEL_THRESH; }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      const ts = touchState.current;
      if (!ts) return;
      const y  = e.touches[0].clientY;
      const dy = ts.y - y;
      ts.acc += dy;
      ts.y = y;
      ts.history.push({ y, t: performance.now() });
      if (ts.history.length > 5) ts.history.shift();
      while (ts.acc >=  TOUCH_THRESH) { nudge(+1, true); ts.acc -= TOUCH_THRESH; }
      while (ts.acc <= -TOUCH_THRESH) { nudge(-1, true); ts.acc += TOUCH_THRESH; }
    };

    el.addEventListener('wheel',     onWheel,     { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel',     onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [nudge]);

  useEffect(() => () => {
    cancelMomentum();
    if (animTimer.current) clearTimeout(animTimer.current);
  }, [cancelMomentum]);

  const handleTouchStart = useCallback((e) => {
    didTouch.current = true;
    cancelMomentum();
    const y = e.touches[0].clientY;
    touchState.current = { y, acc: 0, history: [{ y, t: performance.now() }] };
  }, [cancelMomentum]);

  const handleTouchEnd = useCallback(() => {
    const ts = touchState.current;
    touchState.current = null;
    if (!ts || ts.history.length < 2) return;

    const hist = ts.history;
    const dt   = hist[hist.length - 1].t - hist[0].t;
    if (dt === 0) return;

    let vel = (hist[0].y - hist[hist.length - 1].y) / dt;
    if (Math.abs(vel) < VEL_THRESH) return;

    momAccum.current = 0;
    const tick = () => {
      vel *= DECEL;
      momAccum.current += vel * 16;
      while (momAccum.current >=  ITEM_H) { nudge(+1, true); momAccum.current -= ITEM_H; }
      while (momAccum.current <= -ITEM_H) { nudge(-1, true); momAccum.current += ITEM_H; }
      rafRef.current = Math.abs(vel) > MIN_VEL ? requestAnimationFrame(tick) : null;
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [nudge]);

  const handleClick = useCallback((e) => {
    if (didTouch.current) { didTouch.current = false; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    nudge(e.clientY < rect.top + rect.height / 2 ? -1 : +1);
  }, [nudge]);

  const safe = value ?? min;
  // Clamp prev/next so they don't show out-of-range values at the boundaries
  const prev = clampVal(safe - 1, min, max);
  const next = clampVal(safe + 1, min, max);

  return (
    <div className="lu-chip lu-chip--wheel">
      <span className="lu-chip-bar" style={{ background: color }} />
      <div className="lu-chip-body">
        <div className="lu-chip-label">{label}</div>
        <div
          ref={trackRef}
          className="lu-wheel-track"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div
            key={anim.id}
            className="lu-wheel-items"
            data-dir={anim.dir}
          >
            {/* At min boundary show blank above; at max boundary show blank below */}
            <div className="lu-wheel-item">{safe === min ? '' : prev}</div>
            <div className="lu-wheel-item active">{safe}</div>
            <div className="lu-wheel-item">{safe === max ? '' : next}</div>
          </div>
        </div>
        {value2 != null && value2 !== value && (
          <span className="lu-chip-value2">→{value2}</span>
        )}
      </div>
    </div>
  );
}
