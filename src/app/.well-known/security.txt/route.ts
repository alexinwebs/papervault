import { siteContact, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** RFC 9116 disclosure file, built from the deployment's own contact and origin. */
export function GET() {
  const site = siteUrl();
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const body = [
    "# PaperVault vulnerability disclosure",
    `Contact: mailto:${siteContact().security}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${site}/.well-known/security.txt`,
    `Policy: ${site}/legal/terms`,
    "",
    "# Please give us 90 days before public disclosure, and do not access,",
    "# modify or exfiltrate data belonging to other users while testing.",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
