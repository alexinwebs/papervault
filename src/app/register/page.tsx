import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AuthScreen } from "@/components/AuthScreen";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage() {
  const colleges = await prisma.college.findMany({
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <AuthScreen
      eyebrow="Join the archive"
      title="Create your contributor account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="pv-link">
            Sign in
          </Link>
          .
        </>
      }
    >
      <div className="pv-panel px-5 py-5">
        <RegisterForm colleges={colleges} />
      </div>
    </AuthScreen>
  );
}
