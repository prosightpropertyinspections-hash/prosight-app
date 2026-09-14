import type { MetadataRoute } from "next";

/* Next generates /manifest.webmanifest from this and injects the <link> tag,
   so nothing has to be added to the document head by hand. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProSight Report Studio",
    short_name: "ProSight",
    description: "Write, photograph and deliver home inspection reports.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#070d16",
    theme_color: "#070d16",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png",     sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png",     sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Schedule", short_name: "Schedule", url: "/schedule" },
      { name: "Settings", short_name: "Settings", url: "/settings" },
    ],
  };
}
