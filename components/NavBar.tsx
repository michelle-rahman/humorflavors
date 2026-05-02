"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </span>
          Humor Flavors
        </Link>

        {/* Breadcrumb hint for sub-pages */}
        {pathname !== "/dashboard" && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-600 flex-1 min-w-0">
            <Link href="/dashboard" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors truncate">
              Dashboard
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800" />
          <button
            onClick={handleSignOut}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
