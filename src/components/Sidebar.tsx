"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PINS_CHANGED_EVENT } from "@/lib/pins-event";
import {
  BarChart3,
  Coffee,
  BookMarked,
  BookOpen,
  FileText,
  Home,
  Inbox,
  LifeBuoy,
  Flag,
  GraduationCap,
  MessageSquare,
  Search,
  Settings,
  Building2,
  Mail,
  Pin,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import { cx } from "@/lib/utils";
import type { Role } from "@/lib/constants";

const PRIMARY = [
  { href: "/", label: "Home", icon: Home },
  { href: "/colleges", label: "Explore Colleges", icon: Search },
  { href: "/programs", label: "Programs", icon: BookOpen },
  { href: "/subjects", label: "Subjects", icon: FileText },
  { href: "/requests", label: "Papers Wanted", icon: MessageSquare },
  { href: "/upload", label: "Upload Paper", icon: UploadCloud },
  { href: "/library", label: "My Library", icon: BookMarked },
];

const SECONDARY = [
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export type PinnedNavCollege = { slug: string; name: string; shortName: string };

/** Shown in the navigation; the full list lives in My Library. */
const PINNED_IN_NAV = 6;
const NO_PINS: PinnedNavCollege[] = [];

export function SidebarNav({
  role,
  unread = 0,
  pinned: pinnedFromServer = NO_PINS,
  coffee = false,
  onNavigate,
}: {
  role?: Role;
  unread?: number;
  pinned?: PinnedNavCollege[];
  /** Show "Buy me a coffee" (on when DONATION_UPI_ID is set). */
  coffee?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Starts from the server's list; a saved pin elsewhere on the page updates
  // it straight away, and a later server render takes over again.
  const [pinned, setPinned] = useState(pinnedFromServer);
  useEffect(() => setPinned(pinnedFromServer), [pinnedFromServer]);
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<PinnedNavCollege[]>).detail;
      if (Array.isArray(detail)) setPinned(detail);
    };
    window.addEventListener(PINS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PINS_CHANGED_EVENT, onChange);
  }, []);
  const staff = role === "MODERATOR" || role === "COLLEGE_ADMIN" || role === "PLATFORM_ADMIN";
  const signedIn = Boolean(role);

  const item = (href: string, label: string, Icon: typeof Home, badge?: number) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        // These are all dynamic, database-backed routes; prefetching a dozen of
        // them on every page render is wasted server work.
        prefetch={false}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 border-2 rounded-sm px-3 py-2 font-mono text-sm transition-colors",
          active
            ? "border-ink bg-navy text-cream shadow-hard-sm"
            : "border-transparent text-ink hover:border-ink hover:bg-cream",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">{label}</span>
        {badge && badge > 0 ? (
          <span className="ml-auto min-w-[20px] rounded-full border-2 border-ink bg-pink px-1 text-center font-mono text-[10px] font-bold leading-[14px] text-ink">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {PRIMARY.map((l) => item(l.href, l.label, l.icon))}
      {signedIn && pinned.length > 0 ? (
        <div className="mt-3" data-testid="nav-my-colleges">
          <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
            My Colleges
          </p>
          <ul className="flex flex-col gap-1">
            {pinned.slice(0, PINNED_IN_NAV).map((college) => {
              const href = `/colleges/${college.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={college.slug}>
                  <Link
                    href={href}
                    prefetch={false}
                    onClick={onNavigate}
                    title={college.name}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 border-2 rounded-sm px-3 py-1.5 font-mono text-[13px] transition-colors",
                      active
                        ? "border-ink bg-yellow shadow-hard-sm"
                        : "border-transparent text-ink hover:border-ink hover:bg-cream",
                    )}
                  >
                    <Pin className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />
                    <span className="truncate">{college.shortName || college.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {pinned.length > PINNED_IN_NAV ? (
            <Link
              href="/library#my-colleges"
              prefetch={false}
              onClick={onNavigate}
              className="mt-1 block px-3 py-1 font-mono text-[11px] text-ink/70 underline-offset-2 hover:underline"
            >
              All {pinned.length} pinned →
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="pv-divider my-3" />
      {/* The header bell is hidden on phones, so this is the only way in. */}
      {signedIn ? item("/inbox", "Notifications", Inbox, unread) : null}
      {SECONDARY.map((l) => item(l.href, l.label, l.icon))}
      {item(signedIn ? "/my-tickets" : "/support", "Support", LifeBuoy)}
      {coffee ? item("/coffee", "Buy me a coffee", Coffee) : null}
      {staff ? (
        <>
          <div className="pv-divider my-3" />
          {item("/moderation", "Moderation", ShieldCheck)}
          {role === "PLATFORM_ADMIN" ? (
            <>
              {item("/admin", "Admin", ShieldCheck)}
              {item("/admin/colleges", "Manage Colleges", Building2)}
              {item("/admin/papers", "Manage Papers", FileText)}
              {item("/admin/users", "Members", Users)}
              {item("/admin/tickets", "Tickets", MessageSquare)}
              {item("/admin/reports", "Reports", Flag)}
              {item("/admin/teacher-verifications", "Teacher Verifications", GraduationCap)}
              {item("/admin/notifications", "Email Outbox", Mail)}
            </>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}
