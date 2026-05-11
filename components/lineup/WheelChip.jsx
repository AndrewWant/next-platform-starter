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

export default function WheelChip({ color, label, value, onChange, min = 1, max = 39, value2 }) {
  const trackRef     = useRef(null);
  const wheelAccum   = useRef(0);
  const touchState   = useRef(null);  // { y, acc, history: [{y, t}] }
  const rafRef       = useRef(null);  // momentum requestAnimationFrame id
  const momAccum     = useRef(0);     // sub-ITEM_H momentum remainder
  const animTimer    = useRef(null);
  const didTouch     = useRef(false); // suppress synthetic click after touch
  const [anim, setAnim] = useState({ dir: 0, id: 0 });

  const range = max - min + 1;

  // Uses functional update so nudge never captures stale `value` from closure.
  // This makes nudge stable (same reference across renders), which lets the
  // non-passive event-listener effect run only once.
  const nudge = useCallback((delta, fromMomentum = false) => {
    onChange(prev => {
      const v = (prev == null ? min : prev);
      return ((v + delta - min) % range + range) % range + min;
    });
    if (!fromMomentum) {
      if (animTimer.current) clearTimeout(animTimer.current);
      // Change `id` to force remount of lu-wheel-items, re-triggering the CSS animation
      setAnim(a => ({ dir: delta > 0 ? 1 : -1, id: a.id + 1 }));
      animTimer.current = setTimeout(() => setAnim(a => ({ ...a, dir: 0 })), 160);
    }
  }, [onChange, min, range]);

  const cancelMomentum = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Wheel and touchmove must be non-passive to call preventDefault (stops page scroll).
  // React synthetic events can't override passive defaults set by the browser, so we
  // attach these directly via useEffect.
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
      const dy = ts.y - y; // positive = finger moved up = value increases
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

  // Cleanup on unmount
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

    let vel = (hist[0].y - hist[hist.length - 1].y) / dt; // px/ms; +ve = value increases
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
    // Suppress the synthetic click that fires ~300ms after touchend on mobile
    if (didTouch.current) { didTouch.current = false; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    nudge(e.clientY < rect.top + rect.height / 2 ? -1 : +1);
  }, [nudge]);

  const safe = value ?? min;
  const prev = ((safe - 1 - min) % range + range) % range + min;
  const next = ((safe + 1 - min) % range + range) % range + min;

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
            <div className="lu-wheel-item">{prev}</div>
            <div className="lu-wheel-item active">{safe}</div>
            <div className="lu-wheel-item">{next}</div>
          </div>
        </div>
        {value2 != null && value2 !== value && (
          <span className="lu-chip-value2">→{value2}</span>
        )}
      </div>
    </div>
  );
}
