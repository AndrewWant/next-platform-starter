import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

const navItems = [
  { linkText: 'Home', href: '/' },
  { linkText: 'Work', href: '/work' },
  { linkText: 'Projects', href: '/projects' },
];

export function Header({ user }) {
  return (
    <nav className="flex flex-wrap items-center gap-4 pt-6 pb-12 sm:pt-12 md:pb-24">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Andrew Want
      </Link>
      {!!navItems?.length && (
        <ul className="flex flex-wrap gap-x-1 gap-y-1 ml-4">
          {navItems.map((item, index) => (
            <li key={index}>
              <Link href={item.href} className="inline-flex px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors">
                {item.linkText}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="ml-auto flex items-center gap-4">
        {user ? (
          <SignOutButton />
        ) : (
          <>
            <Link
              href="https://linkedin.com/in/andrewwant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              LinkedIn
            </Link>
            <Link
              href="https://github.com/andrewwant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              GitHub
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
