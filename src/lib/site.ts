/**
 * Operator contact details, read at request time so one image can be deployed
 * by anyone. Set these before launch; the defaults are deliberately obvious.
 */
export function siteContact() {
  const fallback = "contact-not-configured@invalid";
  const contact = process.env.CONTACT_EMAIL || fallback;
  return {
    operator: process.env.OPERATOR_NAME || "the PaperVault operator",
    contact,
    grievance: process.env.GRIEVANCE_OFFICER_EMAIL || contact,
    grievanceName: process.env.GRIEVANCE_OFFICER_NAME || "Grievance Officer",
    security: process.env.SECURITY_CONTACT_EMAIL || contact,
    configured: contact !== fallback,
  };
}

/**
 * Public origin of the deployment, without a trailing slash.
 *
 * Read through an indirect key on purpose: Next inlines any literal
 * `process.env.NEXT_PUBLIC_*` at build time, which would freeze whatever value
 * the build machine had. Server code must see the runtime value.
 */
export function siteUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const key = "NEXT_PUBLIC_SITE_URL";
  return (env.SITE_URL || env[key] || "http://localhost:3000").replace(/\/$/, "");
}

/** Raw configured value (no default), for validation. */
export function configuredSiteUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const key = "NEXT_PUBLIC_SITE_URL";
  return env.SITE_URL || env[key] || "";
}
