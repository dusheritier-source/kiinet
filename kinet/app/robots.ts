import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/billing",
        "/drafts",
        "/edit-profile",
        "/messages",
        "/moderation",
        "/notifications",
        "/onboarding",
        "/profile/data",
        "/profile/insights",
        "/saved",
        "/settings",
        "/test-env",
        "/test-realtime",
        "/upload",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
