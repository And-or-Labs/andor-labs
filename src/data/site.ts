// All landing page copy. The page is a short parent-company introduction:
// who we are, the lines of work, proof, one call to action.
// Claims rule: VJ led marketing and sales ops at Blockthrough and AdPushup
// through their acquisitions. He did not found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | Applied AI lab for media and adtech",
  description: "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups win their category.",
  tagline: "Don't just go to market. Win it.",
};

export const NAV = [
  { label: "What we do", href: "/#what-we-do" },
  { label: "Proof", href: "/#proof" },
  { label: "Writing", href: "/blog/" },
];

export const CTA = { label: "Book a call", href: BOOKING_URL, external: true };

export const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/jatain/" },
  { label: "X / Twitter", href: "https://x.com/eclecticV" },
  { label: "GitHub", href: "https://github.com/eclecticv" },
];

export const HERO = {
  label: "Applied AI lab · Est. 2025",
  title: "We're an applied AI lab for media and adtech.",
  lede: "We build our own products and help early-stage startups win their category.",
};

export const LINES = {
  product: {
    label: "Product",
    name: "MediaContext",
    body: "Market intelligence for the premium open web.",
    note: "Invite-only. Seven markets.",
    href: "https://mediacontext.dev",
    image: "/products/mediacontext-publishers.webp",
    alt: "MediaContext Publishers view: premium publishers ranked by traffic, with sales house, ad formats, header bidding and ad density per account.",
  },
  services: {
    label: "Services",
    name: "GTM services",
    body: "We help early-stage startups find product-market fit, accelerate revenue growth, and win their category.",
    href: BOOKING_URL,
    cta: "Book a call",
  },
  writing: {
    label: "Writing",
    name: "Field notes",
    body: "Occasional posts and rants about marketing, startups, media, and adtech.",
    href: "/blog/",
    cta: "Read the blog",
  },
};

export const PARTNERS = [
  { name: "NVIDIA Inception", src: "/partners/nvidia-inception.svg", h: 28 },
  { name: "AirOps", src: "/partners/airops.svg", h: 20 },
  { name: "Snitcher", src: "/partners/snitcher.svg", h: 13 },
  { name: "Superdesign", src: "/partners/superdesign.svg", h: 22 },
  { name: "Boardy", src: "/partners/boardy.png", h: 24 },
];

export const FOUNDER = {
  name: "Vishveshwar Jatain",
  photo: "/founder.png",
  line: "Founded by Vishveshwar Jatain, who led marketing and sales ops at Blockthrough (acquired by eyeo) and AdPushup (acquired by Geniee).",
  linkedin: "https://www.linkedin.com/in/jatain/",
};

// Outlets with VJ's bylines or coverage of work he led.
export const PRESS = ["Digiday", "Adweek", "AdExchanger", "CNET", "ExchangeWire", "eMarketer", "Forbes Councils"];

export const TESTIMONIALS = [
  { author: "Scott Konopasek", role: "Co-founder & COO, Filament", quote: "VJ brought a thoughtful approach to the UX, positioning, and messaging during the site redesign process.", headshot: null },
  { author: "Marty Kratky-Katz", role: "Exited Tech Founder", quote: "VJ is the best B2B marketer I've worked with.", headshot: "/testimonials/marty-kratky-katz.jpg" },
  { author: "Sudhiranjan Bannerjee", role: "Senior Trade Officer, Govt. of Alberta", quote: "VJ has an uncanny ability to say the most complex things in the most simple manner, which requires clear understanding and clarity of thoughts.", headshot: "/testimonials/sudhiranjan-bannerjee.jpg" },
];
