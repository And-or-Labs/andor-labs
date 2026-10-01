// Every piece of copy on the landing page, in one place.
// Sources: the previous andorlabs.ca build (hero promise, offers, FAQ),
// VJ's Homepage v2 note (the lab line), and the archived About/Portfolio data
// (testimonials, press, projects). Claims follow one rule: VJ led marketing and
// sales ops at Blockthrough and AdPushup through their acquisitions. He did not
// found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | Applied AI lab for media and adtech",
  description:
    "An applied AI lab for media and adtech. We build products like MediaContext and help early-stage startups find product-market fit, accelerate revenue growth, and win their category.",
  tagline: "Don't just go to market. Win it.",
};

export const NAV = [
  { label: "What we do", href: "/#what-we-do" },
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  { label: "About", href: "/#about" },
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
  lede: "Foundation models, system one decision engines, and agent workflows, built into our own products and into the go-to-market of the startups we work with.",
};

export const PARTNERS = [
  { name: "NVIDIA Inception", src: "/partners/nvidia-inception.svg", h: 30 },
  { name: "AirOps", src: "/partners/airops.svg", h: 22 },
  { name: "Snitcher", src: "/partners/snitcher.svg", h: 13 },
  { name: "Superdesign", src: "/partners/superdesign.svg", h: 24 },
  { name: "Boardy", src: "/partners/boardy.png", h: 26 },
];

export const FOUNDER_LINE =
  "Founded by Vishveshwar Jatain, who led marketing and sales ops at Blockthrough and AdPushup through their acquisitions.";

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
    href: "/#services",
  },
  writing: {
    label: "Writing",
    name: "Field notes",
    body: "Working notes, operator playbooks, and post-mortems. No growth-hacking listicles.",
    href: "/blog/",
  },
};

export const CAPABILITIES = [
  { title: "Positioning & web design", body: "Bulletproof your pitch by auditing it against peer-reviewed findings on brand, messaging, design, pricing, etc., then pair it with a site built on modern frameworks." },
  { title: "Tech stack & analytics", body: "Get the insights you need to make better GTM decisions by reviewing your tech stack, tag setup, and analytics pipes to understand gaps and areas of improvement." },
  { title: "Research, data & IP creation", body: "Establish your topical authority with custom industry reports, white papers, and thematic content series that earn press coverage, buyer attention, and sales pipeline." },
  { title: "Search, AI & social growth", body: "Track and improve your share of voice in search, AI citations, and social channels by producing high-quality content rooted in a deep understanding of your ICP." },
  { title: "AI × GTM transformation", body: "Build repeatable systems for every aspect of your GTM process including brand, creative, growth, analytics, operations, etc., with custom skills, plugins, and AI agents." },
];

export const OFFERS = [
  {
    kind: "Advisory",
    name: "Advisor",
    blurb: "For idea / pre-seed stage startups who want to sharpen their pitch for investors and build their early go-to-market strategy.",
    price: "$995",
    per: "/mo + advisor equity",
    cta: "Discuss Advisor",
    feats: ["SaaS & GTM benchmark", "Crawl → walk → run roadmap", "Board, hiring & fundraising", "Early And/or tool access", "Slack, email + monthly call"],
  },
  {
    kind: "Sprint",
    name: "GTM Refresh",
    blurb: "For startups of any stage who want a modern, AI-native brand & marketing foundation to build their growth engine.",
    price: "$9,995",
    per: "one-time",
    cta: "Scope GTM Refresh",
    feats: ["Brand system overhaul", "Pitch-to-page messaging", "New AI-ready website", "CMS + analytics setup", "Social launch kit"],
    featured: true,
  },
  {
    kind: "Fractional",
    name: "GTM Copilot",
    blurb: "For seed / series A startups who have signs of product-market fit and are looking to scale to the next set of growth milestones.",
    price: "$4,995",
    per: "/mo · 3-month min",
    cta: "Discuss GTM Copilot",
    feats: ["GTM roadmap development", "Ghostwritten founder content", "Managed SEO/AEO growth", "Quarterly custom project", "Slack, email + weekly call"],
  },
];

export const CASE_STUDY = {
  client: "Filament",
  url: "https://www.wearefilament.com",
  industry: "Human-verified brand safety for YouTube",
  service: "GTM Refresh",
  title: "A WordPress site rebuilt as a Next.js brand in nine days.",
  summary:
    "Modernizing a WordPress site into a Next.js build, with Sanity CMS, and WebGL used to render a moving prism in the hero section; signifying the brand's promise of illumination.",
  before: { src: "/case-studies/filament/before-hero.png", alt: "Filament's legacy WordPress homepage, a bright purple and pink layout with a 'Reduce Wasted YouTube Ad Spend' headline." },
  after: { src: "/case-studies/filament/after-hero.webp", alt: "Filament's new homepage hero, a dark WebGL prism-light animation behind the headline." },
  metrics: [
    { value: "9 days", label: "Build window" },
    { value: "100", label: "Lighthouse SEO" },
    { value: "1.09s", label: "Largest Contentful Paint" },
    { value: "0.00", label: "Layout shift" },
  ],
  quote: "VJ brought a thoughtful approach to the UX, positioning, and messaging during the site redesign process, and a much-needed ‘been-there-done-that’ perspective to many parts of our business.",
  quoteBy: "Scott Konopasek",
  quoteRole: "Co-founder & COO, Filament",
};

export const TESTIMONIALS = [
  { author: "Marty Kratky-Katz", role: "Exited Tech Founder", quote: "VJ is the best B2B marketer I've worked with. I'd recommend him to anyone looking for a marketing leader who thrives in early-stage chaos.", headshot: "/testimonials/marty-kratky-katz.jpg" },
  { author: "Trevor Thomas", role: "ex-OpenX/Experian/AT&T Revenue Exec", quote: "VJ performed every marketing work we needed until we could afford additional help. His calm demeanour, internal drive, and dry and incredibly appreciated sense of humor made working with him a delight every single day.", headshot: "/testimonials/trevor-thomas.jpg" },
  { author: "Shubham Grover", role: "Founder of Assist", quote: "VJ's eye for design and details with the ability to look at the big picture was unlike any I've seen before. As a team member and as someone who worked under his leadership, VJ earns my highest recommendation.", headshot: "/testimonials/shubham-grover.jpg" },
  { author: "Sudhiranjan Bannerjee", role: "Senior Trade Officer, Govt. of Alberta, Canada", quote: "VJ has an uncanny ability to say the most complex things in the most simple manner, which requires clear understanding and clarity of thoughts.", headshot: "/testimonials/sudhiranjan-bannerjee.jpg" },
  { author: "Sandeep Bansal", role: "CEO @ GoZupees", quote: "VJ is an extremely talented and gifted individual, who knows how to get things done. I have always relied on his out-of-the-box thinking to produce effective content. He is an asset for any media organization.", headshot: "/testimonials/sandeep-bansal.jpg" },
];

export const FOUNDER = {
  name: "Vishveshwar Jatain",
  role: "Founder",
  photo: "/founder.png",
  bio: "And/or Labs was founded by Vishveshwar Jatain, who previously led marketing and sales operations at two advertising technology startups, Blockthrough (acquired by eyeo in 2022) and AdPushup (acquired by Geniee in 2023).",
  linkedin: "https://www.linkedin.com/in/jatain/",
  projects: [
    { name: "PageFair Adblock Reports", role: "Editor & researcher", body: "Editor (2020, 2021, 2022, 2024), researcher and publisher of the industry-standard annual report on ad blocking trends.", href: "https://blockthrough.com/blog/category/reports/" },
    { name: "Slice of AdTech", role: "Host & producer", body: "A podcast exploring the ad tech ecosystem.", href: "https://sliceofadtech.buzzsprout.com/2043731/episodes" },
  ],
  investments: [
    { name: "The Fort Distillery", location: "SK", body: "Craft gin, vodka and whisky from Fort Qu'Appelle, Saskatchewan.", href: "https://thefortdistillery.com/" },
    { name: "VoltSafe", location: "BC", body: "Magnetic electrical connections replacing prong-based plugs.", href: "https://voltsafe.com/" },
  ],
};

export const PRESS = {
  bylines: [
    { title: "Advertising's Gen Z obsession misses the bigger picture", source: "ExchangeWire", href: "https://www.exchangewire.com/blog/2025/08/13/advertisings-gen-z-obsession-misses-the-bigger-picture/" },
    { title: "Consumer Attitudes Toward Digital Advertising 2021", source: "eMarketer", href: "https://www.emarketer.com/content/consumer-attitudes-toward-digital-advertising-2021" },
    { title: "'It can be a money-printing machine': The revival of auto-refreshing ads", source: "Digiday", href: "https://digiday.com/media/can-money-printing-machine-incredible-revival-auto-refreshing-ads/" },
    { title: "Facebook's not listening to you, its new ad disclosure feature screams", source: "TNW", href: "https://thenextweb.com/news/facebooks-totally-not-listening-to-you-its-new-ad-disclosure-feature-screams-desperately" },
    { title: "Google Chrome's policy change won't stop targeted ads", source: "ConsumerAffairs", href: "https://www.consumeraffairs.com/news/google-chromes-recent-privacy-policy-change-wont-stop-targeted-ads-030821.html" },
    { title: "10 UX tools marketers need to know about", source: "MarketingProfs", href: "https://www.marketingprofs.com/articles/2015/27842/10-user-experience-testing-tools-marketers-need-to-know-about" },
  ],
  coverage: [
    { title: "How CafeMedia recouped millions through adblock recovery", source: "Adweek", href: "https://www.adweek.com/programmatic/how-cafemedia-recouped-millions-through-ad-block-recovery/" },
    { title: "How AccuWeather shored up revenue with ad-blocking audience", source: "AdExchanger", href: "https://www.adexchanger.com/online-advertising/how-accuweather-shored-up-revenue-by-monetizing-its-ad-blocking-audience/" },
    { title: "Ad blocking surges as millions more seek privacy, less annoyance", source: "CNET", href: "https://www.cnet.com/news/privacy/ad-blocking-surges-as-millions-more-seek-privacy-security-and-less-annoyance/" },
    { title: "Publishers forecast to lose $54B in revenue from ad-blocking", source: "MediaPost", href: "https://www.mediapost.com/publications/article/391246/publishers-forecast-to-lose-54b-in-revenue-from-a.html" },
    { title: "Why ad block users are not all 'militant ad haters'", source: "The Media Leader", href: "https://the-media-leader.com/why-ad-block-users-are-not-all-militant-ad-haters/" },
    { title: "Working with web publishers, this startup has notched up $10M ARR", source: "YourStory", href: "https://yourstory.com/2020/01/startup-adtech-saas-ad-pushup-web-publishers" },
  ],
  archives: [
    { name: "Forbes Communications Council", href: "https://www.forbes.com/councils/forbescommunicationscouncil/people/vishveshwarjatain/" },
    { name: "Digital Content Next", href: "https://digitalcontentnext.org/blog/author/vishveshwar/" },
    { name: "Blockthrough", href: "https://blockthrough.com/blog/author/vjblockthrough-com/" },
  ],
};

export const FAQS = [
  ["How is this different from a typical marketing agency?", "Agencies staff you with a junior account team and run the same playbook. Here you work directly with an operator who led marketing and sales ops at two adtech startups through their acquisitions. The work spans the whole GTM rather than one slice of it."],
  ["Which engagement should I start with?", "It depends on the stage you are at. Advisor at $995/mo plus advisor equity if you are pre-seed and still sharpening the pitch for investors. GTM Refresh at $9,995 if the product is further along than the brand. GTM Copilot at $4,995/mo once you have product-market fit signals and need someone to own the roadmap. If none of those obviously fit, book a call and we will figure it out on the call."],
  ["How quickly will we see results?", "GTM Refresh ships a new site and refreshed positioning in weeks. Advisory work runs on a monthly cadence and compounds from there. GTM Copilot carries a three-month minimum because pipeline built faster than that is usually borrowed rather than earned."],
  ["Do you only work with early-stage startups?", "The operator track record was earned in adtech: a technically literate buyer, hard to impress, quick to spot a bluff. That transfers to most technical categories, and plenty of adjacent ones work fine too. Book a call and you will get an honest read on fit before anyone signs anything."],
  ["Who will I actually be working with?", "The founder, directly. No account layers and no handoff once the pitch is over. The person auditing your funnel is the same person who led marketing and sales operations at Blockthrough and AdPushup through their acquisitions."],
] as const;
