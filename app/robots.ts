import type { MetadataRoute } from "next";

/** Block all crawlers — this app holds personal health data and must not be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
