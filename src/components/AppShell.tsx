import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { unreadCount } from "@/server/services/inbox";
import { myPinnedColleges } from "@/server/services/pins";
import { SidebarNav } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { GlobalSearch } from "./GlobalSearch";
import { logoutAction } from "@/server/actions/auth";
import { BrandLockup, LogoMark } from "./Brand";
import { NavigationTracker } from "./NavigationTracker";
import { donationConfig } from "@/lib/features";

const FOOTER_LINKS = [
  { href: "/guide", label: "Start here" },
  { href: "/colleges", label: "Colleges" },
  { href: "/upload", label: "Contribute" },
  { href: "/statistics", label: "Statistics" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/guidelines", label: "Guidelines" },
  { href: "/legal/academic-integrity", label: "Academic integrity" },
  { href: "/legal/takedown", label: "Takedown" },
  { href: "/legal/contact", label: "Contact" },
  { href: "/support", label: "Support" },
];

/**
 * Full-viewport application shell.
 * Desktop: fixed sidebar + editorial content column.
 * Phone/tablet: sticky header with a slide-in drawer and a search-first layout.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const coffee = Boolean(donationConfig());
  const [unread, pinRows] = user
    ? await Promise.all([unreadCount(user.id), myPinnedColleges(user.id)])
    : [0, []];
  // Only what the navigation needs; this list is the signed-in user's own.
  const pinned = pinRows.map((row) => ({
    slug: row.college.slug,
    name: row.college.name,
    shortName: row.college.shortName,
  }));

  return (
    <div className="flex min-h-[100svh] w-full bg-cream">
      <Suspense fallback={null}>
        <NavigationTracker />
      </Suspense>
      <aside className="sticky top-0 hidden h-[100svh] w-[248px] shrink-0 flex-col justify-between overflow-y-auto border-r-2 border-ink bg-blue-light px-4 py-5 lg:flex">
        <div>
          <BrandLockup stacked markSize={44} priority />
          <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink/70">
            College papers.
            <br />
            Always with you.
          </p>
          <div className="mt-6">
            <SidebarNav role={user?.role} unread={unread} pinned={pinned} coffee={coffee} />
          </div>
        </div>
        <div className="pv-panel-flat mt-8 bg-blue-soft px-3 py-3 font-mono text-[11px] leading-relaxed">
          Keep learning
          <br />
          Keep sharing
          <br />
          <span className="text-ink/60">— PaperVault</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b-2 border-ink bg-cream px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
          <MobileNav role={user?.role} unread={unread} pinned={pinned} coffee={coffee} />
          <Link href="/" aria-label="PaperVault home" className="shrink-0 lg:hidden">
            <LogoMark size={34} priority />
          </Link>
          <Suspense fallback={<div className="h-10 flex-1" />}>
            <GlobalSearch compact id="global-search-header" />
          </Suspense>
          {user ? (
            <Link
              href="/inbox"
              prefetch={false}
              className="pv-btn-ghost relative hidden px-2 sm:inline-flex"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {unread > 0 ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 min-w-[18px] rounded-full border-2 border-ink bg-pink px-1 text-center font-mono text-[10px] font-bold leading-[14px]"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          {user ? (
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/contributors/${user.id}`} className="hidden max-w-[12rem] text-right md:block">
                <span className="block font-mono text-sm font-bold leading-tight truncate" title={user.name}>{user.name}</span>
                <span className="block font-sans text-[11px] capitalize text-ink/60">
                  {user.role.replace(/_/g, " ").toLowerCase()}
                </span>
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="pv-btn-secondary px-2 sm:px-4">
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/login" className="pv-btn-secondary px-2 sm:px-4">
                Sign in
              </Link>
              <Link href="/register" className="pv-btn-primary hidden sm:inline-flex">
                Join
              </Link>
            </div>
          )}
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-8"><div className="mx-auto w-full min-w-0 max-w-[1600px]">{children}</div></main>

        <footer className="flex flex-col gap-3 border-t-2 border-ink px-3 py-3 font-mono text-[11px] text-ink/70 xl:flex-row xl:items-center xl:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark size={22} />
            <span>© {new Date().getFullYear()} PaperVault | Open knowledge. Stronger students.</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            {[...FOOTER_LINKS, ...(coffee ? [{ href: "/coffee", label: "Buy me a coffee" }] : [])].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                // Six dynamic routes in a footer on every page is a prefetch
                // storm; the footer is not a primary navigation path.
                prefetch={false}
                className="pv-link px-1 py-1 no-underline hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
