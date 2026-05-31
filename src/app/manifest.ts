import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAGEN RESORT POS",
    short_name: "RAGEN POS",
    description: "Premium resort point of sale and hospitality management",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#022c22",
    theme_color: "#059669",
    orientation: "any",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
