import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { LogoMark } from "@/components/Brand";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        as="h1"
        media={<LogoMark size={72} elevated />}
        title="404 — nothing filed here."
        body="This page does not exist, or the paper was removed from the archive."
        action={
          <>
            <Link href="/colleges" className="pv-btn-primary">
              Explore colleges
            </Link>
            <Link href="/" className="pv-btn-secondary">
              Back to home
            </Link>
          </>
        }
      />
    </div>
  );
}
