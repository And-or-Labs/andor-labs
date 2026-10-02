// Every piece of copy on the site, in one place.
// Sources: VJ's Homepage v2 note, the October 2026 long-form build (08891d2:src/data/site.ts),
// and the MediaContext / Megafly / zero-click READMEs. Claims rule: VJ led marketing and
// sales ops at Blockthrough and AdPushup through their acquisitions. He did not found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";
export const EMAIL = "vj@andorlabs.ca";

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | Applied AI lab for early-stage tech startups",
  description:
    "An applied AI lab enabling early-stage tech startups. We build products like MediaContext, run GTM consulting, and publish field notes.",
};

export const SOCIALS = [
  { id: "email", label: "Email", href: `mailto:${EMAIL}` },
  { id: "github", label: "GitHub", href: "https://github.com/eclecticv" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/jatain/" },
  { id: "x", label: "X", href: "https://x.com/eclecticV" },
] as const;

export const HOME = {
  title: "We're an applied AI lab enabling early-stage tech startups.",
  emphasis: "applied AI lab",
  founder: "Founded by Vishveshwar Jatain, who led marketing and sales ops at Blockthrough and AdPushup through their acquisitions.",
};

export type Fig = "ripple" | "radar" | "growth" | "flask" | "press" | "notes";
export type Color = "blue" | "coral" | "green" | "lilac" | "butter";

export const MENU: { n: number; href: string; label: string; hint: string; fig: Fig; color: Color }[] = [
  { n: 1, href: "/mediacontext/", label: "MediaContext", hint: "Our product. Market intelligence for the premium open web.", fig: "radar", color: "blue" },
  { n: 2, href: "/gtm/", label: "GTM Consulting", hint: "Positioning, sites and pipeline for early-stage startups. Three ways to engage.", fig: "growth", color: "coral" },
  { n: 3, href: "/experiments/", label: "Experiments", hint: "A fly that trades ad budgets, and a clock counting down the click.", fig: "flask", color: "green" },
  { n: 4, href: "/published/", label: "Published work", hint: "Bylines and coverage in Digiday, Adweek, AdExchanger and others.", fig: "press", color: "lilac" },
  { n: 5, href: "/notes/", label: "Notes", hint: "Field notes on GTM, AI and the post-software era. Newest first.", fig: "notes", color: "butter" },
];

export const PARTNERS = [
  { name: "NVIDIA Inception", src: "/partners/nvidia-inception.svg", h: 26 },
  { name: "AirOps", src: "/partners/airops.svg", h: 18 },
  { name: "Snitcher", src: "/partners/snitcher.svg", h: 12 },
  { name: "Superdesign", src: "/partners/superdesign.svg", h: 22 },
  { name: "Boardy", src: "/partners/boardy.png", h: 22 },
];

export const PRINTED_IN = ["Digiday", "Adweek", "AdExchanger", "ExchangeWire", "eMarketer", "Forbes"];

export const MEDIACONTEXT = {
  title: "Market intelligence for the premium open web.",
  lede: "MediaContext helps technical sales houses find their next best publisher account. Deep, fresh, evidence-backed.",
  facts: [
    ["Access", "Invite-only"],
    ["Markets", "Seven"],
    ["Coverage", "Tranco top 100,000 domains with a Sincera publisher ID"],
  ],
  image: { src: "/products/mediacontext-publishers.webp", alt: "MediaContext Publishers view: premium publishers ranked by traffic, with sales house, ad formats, header bidding and ad density per account." },
  href: "https://mediacontext.dev",
};

export const GTM = {
  title: "Don't just go to market. Win it.",
  lede: "We help early-stage startups find product-market fit, accelerate revenue growth, and win their category. You work with the founder directly. No account layers.",
  capabilities: [
    "Positioning and web design",
    "Tech stack and analytics",
    "Research, data and IP creation",
    "Search, AI and social growth",
    "AI x GTM transformation",
  ],
  offers: [
    { name: "Advisor", for: "Idea and pre-seed", price: "$995/mo + advisor equity" },
    { name: "GTM Refresh", for: "Any stage", price: "$9,995 one-time" },
    { name: "GTM Copilot", for: "Seed and Series A", price: "$4,995/mo, 3-month min" },
  ],
  caseStudy: { client: "Filament", line: "A WordPress site rebuilt as a Next.js brand in nine days.", metrics: ["9 days", "100 Lighthouse SEO", "1.09s LCP"], href: "https://www.wearefilament.com" },
};

export const TESTIMONIALS = [
  { quote: "VJ brought a thoughtful approach to the UX, positioning, and messaging during the site redesign process, and a much-needed 'been-there-done-that' perspective to many parts of our business.", author: "Scott Konopasek", role: "Co-founder & COO, Filament" },
  { quote: "VJ is the best B2B marketer I've worked with. I'd recommend him to anyone looking for a marketing leader who thrives in early-stage chaos.", author: "Marty Kratky-Katz", role: "Exited tech founder" },
  { quote: "VJ's eye for design and details with the ability to look at the big picture was unlike any I've seen before.", author: "Shubham Grover", role: "Founder, Assist" },
  { quote: "VJ has an uncanny ability to say the most complex things in the most simple manner.", author: "Sudhiranjan Bannerjee", role: "Senior Trade Officer, Govt. of Alberta" },
];

export const EXPERIMENTS = [
  {
    name: "Megafly",
    file: "MEGAFLY.EXE",
    body: "A Three.js fly at a laptop, driven by a computed replay of 1,045 real neurons from the MaleCNS connectome. It moves a paper ad budget between display, video and native. No returns are fabricated.",
    cta: "Open Megafly",
    href: "/megafly/",
    external: false,
  },
  {
    name: "Zero-click doomsday clock",
    file: "DOOMSDAY.CLK",
    body: "A TimesFM forecast of search-referral decay to publishers, 2015 to 2034, across all 29 IAB categories. A frozen artifact, not a curve fit.",
    cta: "Open the clock",
    href: "https://zeroclick.grok.me",
    external: true,
  },
];

export const PRESS = {
  bylines: [
    { title: "Advertising's Gen Z obsession misses the bigger picture", source: "ExchangeWire", href: "https://www.exchangewire.com/blog/2025/08/13/advertisings-gen-z-obsession-misses-the-bigger-picture/" },
    { title: "Consumer attitudes toward digital advertising 2021", source: "eMarketer", href: "https://www.emarketer.com/content/consumer-attitudes-toward-digital-advertising-2021" },
    { title: "'It can be a money-printing machine': the revival of auto-refreshing ads", source: "Digiday", href: "https://digiday.com/media/can-money-printing-machine-incredible-revival-auto-refreshing-ads/" },
    { title: "Facebook's not listening to you, its new ad disclosure feature screams", source: "TNW", href: "https://thenextweb.com/news/facebooks-totally-not-listening-to-you-its-new-ad-disclosure-feature-screams-desperately" },
  ],
  coverage: [
    { title: "How CafeMedia recouped millions through adblock recovery", source: "Adweek", href: "https://www.adweek.com/programmatic/how-cafemedia-recouped-millions-through-ad-block-recovery/" },
    { title: "How AccuWeather shored up revenue with its ad-blocking audience", source: "AdExchanger", href: "https://www.adexchanger.com/online-advertising/how-accuweather-shored-up-revenue-by-monetizing-its-ad-blocking-audience/" },
    { title: "Ad blocking surges as millions more seek privacy", source: "CNET", href: "https://www.cnet.com/news/privacy/ad-blocking-surges-as-millions-more-seek-privacy-security-and-less-annoyance/" },
    { title: "Publishers forecast to lose $54B in revenue from ad blocking", source: "MediaPost", href: "https://www.mediapost.com/publications/article/391246/publishers-forecast-to-lose-54b-in-revenue-from-a.html" },
  ],
  archives: [
    { name: "Forbes Communications Council", href: "https://www.forbes.com/councils/forbescommunicationscouncil/people/vishveshwarjatain/" },
    { name: "Digital Content Next", href: "https://digitalcontentnext.org/blog/author/vishveshwar/" },
    { name: "Blockthrough", href: "https://blockthrough.com/blog/author/vjblockthrough-com/" },
  ],
};

export const NOTES = {
  title: "Field notes.",
  lede: "Working notes, operator playbooks, and post-mortems. No growth-hacking listicles.",
};
