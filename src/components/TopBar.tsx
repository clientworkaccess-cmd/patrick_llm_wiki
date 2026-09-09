import Link from 'next/link';
import { Network } from 'lucide-react';
import type { ReactNode } from 'react';
import { LogoutButton } from './LogoutButton';

/** Floating pill navbar, glassmorphism. Sticky layer of the z-index contract. */
export function TopBar({
  children,
  showLogout = true,
}: {
  children?: ReactNode;
  showLogout?: boolean;
}) {
  return (
    <header className="sticky top-0 z-sticky px-4 pt-4 sm:px-6">
      <div className="glass mx-auto flex max-w-shell items-center gap-4 rounded-xl px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <Network className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <span className="font-semibold tracking-tight">
            Knowledge <span className="font-serif italic text-accent">Graph</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {children}
          {showLogout && <LogoutButton />}
        </div>
      </div>
    </header>
  );
}
