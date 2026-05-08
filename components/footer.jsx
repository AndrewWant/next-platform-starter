export function Footer() {
  return (
    <footer className="pt-16 pb-12 sm:pt-24 sm:pb-16 border-t border-slate-700/50">
      <p className="text-sm text-slate-500">
        &copy; {new Date().getFullYear()} Andrew Want. Built with Next.js &amp; Supabase.
      </p>
    </footer>
  );
}
