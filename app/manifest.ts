import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/content/queries";
import { resolveImageSrc } from "@/lib/images/drive";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { favicon } = await getPublicSettings();
  const icon = resolveImageSrc(favicon);
  return {
    name: "UnseenBox",
    short_name: "UnseenBox",
    description: "Independent game & creative technology studio.",
    start_url: "/",
    display: "standalone",
    background_color: "#050407",
    theme_color: "#050407",
    icons: icon
      ? [{ src: icon, sizes: "any" }]
      : [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
