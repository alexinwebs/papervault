import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Built per request: it reads the runtime site URL (and, for the sitemap, the database).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = siteUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/moderation", "/admin", "/library", "/settings", "/api/"] },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
