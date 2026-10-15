import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { PUBLIC_PAPER_WHERE } from "@/server/repositories/papers";
import { collegeHref, paperHref } from "@/lib/links";
import { siteUrl } from "@/lib/site";

// Built per request: it reads the runtime site URL (and, for the sitemap, the database).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const [colleges, papers] = await Promise.all([
    prisma.college.findMany({ select: { slug: true } }),
    prisma.paper.findMany({
      where: PUBLIC_PAPER_WHERE,
      select: { id: true, publishedAt: true },
      take: 5000,
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/guide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/colleges`, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/statistics`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${site}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/legal/takedown`, changeFrequency: "yearly", priority: 0.3 },
    ...colleges.map((c) => ({ url: `${site}${collegeHref(c.slug)}`, priority: 0.7 })),
    ...papers.map((p) => ({
      url: `${site}${paperHref(p.id)}`,
      lastModified: p.publishedAt ?? undefined,
      priority: 0.5,
    })),
  ];
}
