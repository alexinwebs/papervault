import Link from "next/link";
import type { Metadata } from "next";
import { AuthScreen } from "@/components/AuthScreen";
import { ResetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthScreen eyebrow="Account" title="Choose a new password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="pv-panel-flat bg-pink px-4 py-3 font-sans text-xs">
          This page needs a reset link.{" "}
          <Link href="/forgot-password" className="pv-link">
            Request one
          </Link>
          .
        </p>
      )}
    </AuthScreen>
  );
}
