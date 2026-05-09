'use client';

/** Reusable slide-in drawer with backdrop. side='right' (default) or 'left'. */
export default function Drawer({ title, onClose, side = 'right', children }) {
  return (
    <div className="lu-drawer-root" onClick={onClose}>
      <div className={`lu-drawer${side === 'left' ? ' left' : ''}`}
           onClick={e => e.stopPropagation()}>
        <header className="lu-drawer-head">
          <h3 style={{ color: 'var(--lu-txt)' }}>{title}</h3>
          <button className="lu-drawer-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="lu-drawer-body">{children}</div>
      </div>
    </div>
  );
}
