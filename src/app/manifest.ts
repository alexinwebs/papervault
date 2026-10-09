import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PaperVault",
    short_name: "PaperVault",
    description: "A student-powered archive of college question papers.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8E8",
    theme_color: "#00002A",
    icons: [
      { src: "/brand/papervault-mark.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/papervault-mark.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
