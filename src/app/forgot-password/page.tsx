import Link from "next/link";
import type { Metadata } from "next";
import { AuthScreen } from "@/components/AuthScreen";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      eyebrow="Account"
      title="Reset your password"
      lead="Enter the address you signed up with and we'll email you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="pv-link">
            Sign in
          </Link>
          .
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
