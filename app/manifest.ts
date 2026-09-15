import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UnseenBox",
    short_name: "UnseenBox",
    description: "Independent game & creative technology studio.",
    start_url: "/",
    display: "standalone",
    background_color: "#050407",
    theme_color: "#050407",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
