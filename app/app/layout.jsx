// Gated app routes get a clean full-screen shell — no portfolio header/footer.
export default function AppShellLayout({ children }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {children}
    </div>
  );
}
