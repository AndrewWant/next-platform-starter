'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function EditableChip({ color, label, value, onChange, min = 1, max = 39, value2, derived }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState('');
  const timerRef  = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const startEdit = useCallback(() => {
    if (!onChange) return;
    clearTimeout(timerRef.current);
    setRaw('');
    setEditing(true);
  }, [onChange]);

  const handleChange = useCallback((e) => {
    // Allow optional leading minus then digits; strip mid-string minus; cap at 3 chars
    const v = e.target.value
      .replace(/[^0-9-]/g, '')
      .replace(/(.)-/g, '$1')   // remove minus unless at position 0
      .slice(0, 3);
    setRaw(v);
    clearTimeout(timerRef.current);
    const num = parseInt(v, 10);
    if (v.length > 0 && !isNaN(num) && num >= min && num <= max) {
      timerRef.current = setTimeout(() => onChange(num), 450);
    }
  }, [onChange, min, max]);

  const commit = useCallback(() => {
    clearTimeout(timerRef.current);
    const num = parseInt(raw, 10);
    if (raw.length > 0 && !isNaN(num) && num >= min && num <= max) onChange(num);
    setEditing(false);
    setRaw('');
  }, [raw, onChange, min, max]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { clearTimeout(timerRef.current); setEditing(false); setRaw(''); }
  }, [commit]);

  const allowsNegative = min < 0;
  const isInteractive  = !!onChange && !derived;

  const chipClass = [
    'lu-chip',
    isInteractive ? 'interactive' : '',
    editing       ? 'editing'     : '',
  ].filter(Boolean).join(' ');

  const barStyle = {
    background: derived ? 'transparent' : color,
    border:     derived ? `1px solid ${color}` : 'none',
  };

  const labelStyle = derived ? { color: 'var(--lu-txt-3)', fontStyle: 'italic' } : {};
  const valueStyle = derived ? { color: 'var(--lu-txt-2)' } : {};

  return (
    <div
      className={chipClass}
      style={isInteractive ? { '--lu-chip-accent': color } : undefined}
      onClick={!editing ? startEdit : undefined}
    >
      <span className="lu-chip-bar" style={barStyle} />
      <div className="lu-chip-body">
        <div className="lu-chip-label" style={labelStyle}>{label}</div>

        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            className="lu-chip-input"
            type="text"
            inputMode={allowsNegative ? 'text' : 'numeric'}
            pattern={allowsNegative ? '-?[0-9]*' : '[0-9]*'}
            value={raw}
            placeholder={String(value ?? '')}
            onChange={handleChange}
            onBlur={commit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="lu-chip-value" style={valueStyle}>
            {value ?? '—'}
            {!editing && value2 != null && value2 !== value && (
              <span style={{ color: 'var(--lu-txt-3)', fontWeight: 500, fontSize: '0.82em' }}>
                →{value2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
