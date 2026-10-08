// Every piece of copy on the site, in one place.
// Sources: VJ's Homepage v2 note, the October 2026 long-form build (08891d2:src/data/site.ts),
// the MediaContext / Megafly / zero-click READMEs, and CV_VJ_Mozilla_Firefox.md
// for Blockthrough and AdPushup career results. Claims rule: VJ led marketing and
// sales ops at Blockthrough and AdPushup through their acquisitions. He did not found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";
export const EMAIL = "vj@andorlabs.ca";

export const book = (placement: string) => `${BOOKING_URL}?utm_source=andorlabs&utm_medium=site&utm_campaign=${placement.startsWith("mediacontext") ? "mediacontext" : "fdm"}&utm_content=${encodeURIComponent(placement)}`;

export const INVITES = {
  mediacontext: { left: 10, total: 10 },
} as const;
export const invites = (k: keyof typeof INVITES) => `${INVITES[k].left}/${INVITES[k].total} beta invites left`;

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | We engineer growth for media & adtech companies",
  description:
    "We engineer growth for media & adtech companies. We build MediaContext, work inside client teams as a forward deployed marketer, run experiments, and publish field notes.",
};

export const SOCIALS = [
  { id: "email", label: "Email", href: `mailto:${EMAIL}` },
  { id: "github", label: "GitHub", href: "https://github.com/eclecticv" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/jatain/" },
  { id: "x", label: "X", href: "https://x.com/eclecticV" },
] as const;

export const HOME = {
  title: "We engineer growth for media & adtech companies",
  emphasis: "engineer growth",
  founder: "Founded by Vishveshwar Jatain, who led marketing and sales ops at Blockthrough and AdPushup through their acquisitions.",
};

export type Fig = "ripple" | "radar" | "growth" | "flask" | "press" | "notes";
export type Color = "blue" | "coral" | "green" | "lilac" | "butter";

export const tone = (c: Color) => `--c: var(--${c}); --ct: var(--${c}-ink)`;

export const MENU: { n: number; href: string; label: string; hint: string; fig: Fig; color: Color }[] = [
  { n: 1, href: "/mediacontext/", label: "MediaContext", hint: "Our product. Find the next publisher account worth calling.", fig: "radar", color: "blue" },
  { n: 2, href: "/fdm/", label: "Forward deployed marketer", hint: "A senior operator inside your team for three months. From $15,000.", fig: "growth", color: "coral" },
  { n: 3, href: "/notes/", label: "Lab notes", hint: "Experiments, and the field notes they turn into.", fig: "flask", color: "green" },
  { n: 4, href: "/record/", label: "On record", hint: "Bylines and coverage in Digiday, Adweek, AdExchanger and others.", fig: "press", color: "lilac" },
];

export const PARTNERS = [
  { name: "NVIDIA Inception", src: "/partners/nvidia-inception.svg", h: 26 },
  { name: "AirOps", src: "/partners/airops.svg", h: 18 },
  { name: "Snitcher", src: "/partners/snitcher.svg", h: 12 },
  { name: "Superdesign", src: "/partners/superdesign.svg", h: 22 },
  { name: "Boardy", src: "/partners/boardy.png", h: 22 },
];

export const PRINTED_IN = ["Digiday", "Adweek", "AdExchanger", "ExchangeWire", "eMarketer", "Forbes", "CNET"];

export const MEDIACONTEXT = {
  title: "Find the next publisher account worth calling.",
  lede: "MediaContext ranks the Tranco top 100,000 domains with a Sincera publisher ID by traffic, then shows the sales house, ad formats, header bidding and ad density behind each account.",
  facts: [
    ["Access", `Invite-only. ${invites("mediacontext")}.`],
    ["Markets", "US, UK, CA, DE, FR, AU, JP"],
    ["Coverage", "Tranco top 100,000 domains with a Sincera publisher ID"],
  ],
  image: { src: "/products/mediacontext-publishers.webp", alt: "MediaContext Publishers view: premium publishers ranked by traffic, with sales house, ad formats, header bidding and ad density per account." },
  href: "https://mediacontext.dev",
  cta: "Book a MediaContext call",
};

export const FDM = {
  title: "A senior marketer, deployed inside your team.",
  lede: "Forward deployed engineers sit with the customer until the software works. I do the same for growth: three months inside your team, finding what holds growth back and building the fix.",
  offer: {
    name: "Growth transformation",
    label: "Custom-scoped engagement",
    from: "From",
    price: "$15,000",
    term: "/ 3 months",
    commitment: "Scope, deliverables and price agreed before signing",
    for: "For a media or adtech company whose product has outgrown its positioning, website and pipeline.",
    description: "We start with a diagnosis of your positioning, website, pipeline and tooling. Then we agree the few changes that will move revenue, and I build them inside your stack.",
    scope: ["A written diagnosis and plan before implementation starts", "Hands-on implementation, one priority at a time", "Priorities and progress reviewed regularly", "Price set by scope, starting at $15,000"],
    cta: "Book a scoping call",
  },
  caseStudy: {
    title: "Filament. From positioning to a shipped site.",
    description: "Positioning, messaging and a WordPress site rebuilt in Next.js, with Sanity CMS and a WebGL hero.",
    href: "https://www.wearefilament.com",
    before: { src: "/case-studies/filament/before-hero.png", alt: "Filament's previous WordPress homepage." },
    after: { src: "/case-studies/filament/after-hero.webp", alt: "The redesigned Filament homepage with its new positioning and WebGL hero." },
  },
  experience: [
    { company: "Blockthrough", role: "Director, Marketing & Sales Operations", result: "3× organic traffic", work: "Built and led the marketing and revenue operations team. Ran search experiments, research-led campaigns, and brand modernization." },
    { company: "AdPushup", role: "Product Marketing Manager", result: "Seed to $10M ARR", work: "Built a content engine spanning 150+ articles, email courses, and webinars, alongside CRM and account-based marketing work." },
  ],
  capabilities: [
    { name: "Positioning & websites", work: "A clear product story and a website that helps buyers take the next step." },
    { name: "Organic growth", work: "SEO, AI search visibility, and content built around relevant buyer questions." },
    { name: "GTM engineering", work: "Account research, CRM workflows, and automation that improve follow-through." },
    { name: "Custom AI agents", work: "A recurring marketing task turned into a deployed, measurable workflow." },
  ],
  process: "We'll discuss what needs to change, confirm fit and budget, and identify the first piece of work. If there's a fit, you'll receive a defined scope and next steps.",
};

export const TESTIMONIALS = [
  { quote: "VJ brought a thoughtful approach to the UX, positioning, and messaging during the site redesign process, and a much-needed 'been-there-done-that' perspective to many parts of our business.", author: "Scott Konopasek", role: "Co-founder & COO, Filament" },
  { quote: "VJ is the best B2B marketer I've worked with. I'd recommend him to anyone looking for a marketing leader who thrives in early-stage chaos.", author: "Marty Kratky-Katz", role: "Exited tech founder" },
  { quote: "VJ's eye for design and details with the ability to look at the big picture was unlike any I've seen before.", author: "Shubham Grover", role: "Founder, Assist" },
  { quote: "VJ has an uncanny ability to say the most complex things in the most simple manner.", author: "Sudhiranjan Bannerjee", role: "Senior Trade Officer, Govt. of Alberta" },
];

export const PRESS = {
  bylines: [
    { title: "Advertising's Gen Z obsession misses the bigger picture", source: "ExchangeWire", href: "https://www.exchangewire.com/blog/2025/08/13/advertisings-gen-z-obsession-misses-the-bigger-picture/" },
    { title: "Consumer attitudes toward digital advertising 2021", source: "eMarketer", href: "https://www.emarketer.com/content/consumer-attitudes-toward-digital-advertising-2021" },
    { title: "'It can be a money-printing machine': the revival of auto-refreshing ads", source: "Digiday", href: "https://digiday.com/media/can-money-printing-machine-incredible-revival-auto-refreshing-ads/" },
    { title: "Facebook's not listening to you, its new ad disclosure feature screams", source: "TNW", href: "https://thenextweb.com/news/facebooks-totally-not-listening-to-you-its-new-ad-disclosure-feature-screams-desperately" },
    { title: "Google Chrome's policy change won't stop targeted ads", source: "ConsumerAffairs", href: "https://www.consumeraffairs.com/news/google-chromes-recent-privacy-policy-change-wont-stop-targeted-ads-030821.html" },
    { title: "10 UX tools marketers need to know about", source: "MarketingProfs", href: "https://www.marketingprofs.com/articles/2015/27842/10-user-experience-testing-tools-marketers-need-to-know-about" },
  ],
  coverage: [
    { title: "How CafeMedia recouped millions through adblock recovery", source: "Adweek", href: "https://www.adweek.com/programmatic/how-cafemedia-recouped-millions-through-ad-block-recovery/" },
    { title: "How AccuWeather shored up revenue with its ad-blocking audience", source: "AdExchanger", href: "https://www.adexchanger.com/online-advertising/how-accuweather-shored-up-revenue-by-monetizing-its-ad-blocking-audience/" },
    { title: "Ad blocking surges as millions more seek privacy", source: "CNET", href: "https://www.cnet.com/news/privacy/ad-blocking-surges-as-millions-more-seek-privacy-security-and-less-annoyance/" },
    { title: "Publishers forecast to lose $54B in revenue from ad blocking", source: "MediaPost", href: "https://www.mediapost.com/publications/article/391246/publishers-forecast-to-lose-54b-in-revenue-from-a.html" },
    { title: "Why ad block users are not all 'militant ad haters'", source: "The Media Leader", href: "https://the-media-leader.com/why-ad-block-users-are-not-all-militant-ad-haters/" },
    { title: "Working with web publishers, this startup has notched up $10M ARR", source: "YourStory", href: "https://yourstory.com/2020/01/startup-adtech-saas-ad-pushup-web-publishers" },
  ],
  media: [
    { name: "PageFair Adblock Reports", role: "Editor", body: "Editor (2020, 2021, 2022, 2024), researcher and publisher of the annual report on ad blocking trends.", href: "https://blockthrough.com/blog/category/reports/" },
    { name: "Slice of AdTech", role: "Host", body: "A podcast exploring the ad tech ecosystem.", href: "https://sliceofadtech.buzzsprout.com/2043731/episodes" },
  ],
  archives: [
    { name: "Forbes Communications Council", href: "https://www.forbes.com/councils/forbescommunicationscouncil/people/vishveshwarjatain/" },
    { name: "Digital Content Next", href: "https://digitalcontentnext.org/blog/author/vishveshwar/" },
    { name: "Blockthrough", href: "https://blockthrough.com/blog/author/vjblockthrough-com/" },
  ],
};

export const RECORD = {
  title: "Bylines, coverage and reports.",
  lede: "What I wrote for the trade press, what the trade press wrote about the work, and the reports and podcast in between.",
};

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
