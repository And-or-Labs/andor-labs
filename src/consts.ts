// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "And/or Labs | Applied AI lab for media and adtech";
export const SITE_DESCRIPTION =
  "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups win their category.";

export const GITHUB_URL =
  "https://github.com/eclecticv";

export const SITE_METADATA = {
  title: {
    default: "And/or Labs | Applied AI lab for media and adtech",
    template: "%s | And/or Labs",
  },
  description:
    "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups win their category.",
  keywords: [
    "And/or Labs",
    "applied AI lab",
    "media",
    "adtech",
    "MediaContext",
    "fractional GTM",
    "go-to-market",
    "positioning",
    "GTM engineering",
  ],
  authors: [{ name: "Vishveshwar Jatain" }],
  creator: "And/or Labs",
  publisher: "And/or Labs",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon/favicon.ico" }],
  },
  openGraph: {
    title: "And/or Labs | Applied AI lab for media and adtech",
    description:
      "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups win their category.",
    siteName: "And/or Labs",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "And/or Labs | Applied AI lab for media and adtech",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "And/or Labs | Applied AI lab for media and adtech",
    description:
      "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups win their category.",
    images: ["/og-image.jpg"],
    creator: "@eclecticV",
  },
};
