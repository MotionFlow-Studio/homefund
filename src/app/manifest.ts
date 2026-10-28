import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeFund",
    short_name: "HomeFund",
    description:
      "See what is left until payday and how much you can spend per day.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Android builds its launch screen from this colour, the icon and the name.
    background_color: "#0f766e",
    theme_color: "#0f766e",
    categories: ["finance", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      { src: "/screenshots/home.jpg", sizes: "1170x2532", type: "image/jpeg", form_factor: "narrow", label: "What is left until payday" },
      { src: "/screenshots/receipt.jpg", sizes: "1170x2532", type: "image/jpeg", form_factor: "narrow", label: "A receipt read line by line" },
    ],
  };
}
