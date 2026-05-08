'use client';

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
