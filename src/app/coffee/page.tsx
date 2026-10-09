import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackBar, PageHeading, Panel } from "@/components/ui";
import { CopyText } from "@/components/CopyText";
import { donationConfig, upiLink } from "@/lib/features";

export const metadata: Metadata = {
  title: "Buy me a coffee",
  description: "PaperVault is free. If it helped you, you can chip in for a coffee over UPI.",
};

export default function CoffeePage() {
  const config = donationConfig();
  if (!config) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <BackBar fallback="/" />
      <PageHeading
        eyebrow="Support PaperVault"
        title="Buy me a coffee"
        description="PaperVault is free and will stay free. It's run by one person, and the server, domain and email cost money every month. If the archive saved you before an exam, a coffee helps keep it online."
      />

      <Panel className="grid gap-6 px-5 py-5 sm:grid-cols-[auto_1fr] sm:items-center" testId="coffee">
        {config.qrSrc ? (
          <div className="pv-panel-flat mx-auto w-[240px] bg-white p-3 sm:mx-0">
            <Image
              src={config.qrSrc}
              alt={`UPI QR code for ${config.upiId}`}
              width={216}
              height={216}
              className="h-auto w-full"
              priority
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="pv-section-title mb-2">Scan with any UPI app</h2>
            <p className="font-sans text-sm text-ink/80">
              Google Pay, PhonePe, Paytm, BHIM or your bank&apos;s app. Any amount is welcome; ₹20–₹50 buys a chai
              or a coffee.
            </p>
          </div>
          <div>
            <p className="pv-label mb-1">UPI ID</p>
            <CopyText value={config.upiId} label="UPI ID" />
          </div>
          <a href={upiLink(config)} className="pv-btn-primary self-start" data-testid="upi-pay">
            Open my UPI app
          </a>
          <p className="font-sans text-[11px] text-ink/60">
            The button works on a phone with a UPI app installed. On a computer, scan the QR code with your phone.
          </p>
        </div>
      </Panel>

      <Panel className="px-5 py-4">
        <h2 className="pv-section-title mb-2">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5 font-sans text-sm text-ink/80">
          <li>It&apos;s completely optional. Paying doesn&apos;t unlock anything, and not paying doesn&apos;t limit anything.</li>
          <li>
            Payments go straight to the admin&apos;s personal UPI account ({config.payeeName}). This is a personal tip,
            not a purchase or a charitable donation, so there&apos;s no receipt or tax benefit.
          </li>
          <li>PaperVault never sees or stores your payment details; the payment happens entirely in your UPI app.</li>
          <li>
            Check the name your app shows before you pay. UPI payments can&apos;t be reversed by us; if something went
            wrong, <Link href="/support" className="pv-link">open a ticket</Link>.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
