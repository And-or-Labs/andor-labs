// Every piece of copy on the site, in one place.
// Sources: VJ's Homepage v2 note, the October 2026 long-form build (08891d2:src/data/site.ts),
// the MediaContext / Megafly / zero-click READMEs, and CV_VJ_Mozilla_Firefox.md
// for Blockthrough and AdPushup career results. Claims rule: VJ led marketing and
// sales ops at Blockthrough and AdPushup through their acquisitions. He did not found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";
export const EMAIL = "vj@andorlabs.ca";

export const book = (placement: string) => `${BOOKING_URL}?utm_source=andorlabs&utm_medium=site&utm_campaign=${placement.startsWith("mediacontext") ? "mediacontext" : "fdm"}&utm_content=${encodeURIComponent(placement)}`;

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | We engineer growth for media & adtech companies",
  description:
    "We engineer growth for media & adtech companies. We build MediaContext, work inside client teams as a forward deployed marketer, run experiments, and publish what we learn.",
};

export const SOCIALS = [
  { id: "email", label: "Email", href: `mailto:${EMAIL}` },
  { id: "github", label: "GitHub", href: "https://github.com/eclecticv" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/jatain/" },
  { id: "x", label: "X", href: "https://x.com/eclecticV" },
] as const;

export const HOME = {
  title: "We engineer growth for media, adtech & emerging tech startups",
  emphasis: "engineer growth",
  founder: "Founded by Vishveshwar Jatain, who led marketing and sales ops at Blockthrough and AdPushup through their acquisitions.",
};

export type Fig = "ripple" | "radar" | "growth" | "flask" | "press" | "notes";
export type Color = "blue" | "coral" | "green" | "lilac" | "butter" | "pink";

export const tone = (c: Color) => `--c: var(--${c}); --ct: var(--${c}-ink)`;

export const MENU: { n: number; href: string; label: string; hint: string; fig: Fig; color: Color }[] = [
  { n: 1, href: "/mediacontext/", label: "MediaContext", hint: "Our product. Find the next publisher account worth calling.", fig: "radar", color: "blue" },
  { n: 2, href: "/fdm/", label: "Forward Deployed Marketer", hint: "A senior operator inside your team. $4,995 a month, three-month minimum.", fig: "growth", color: "pink" },
  { n: 3, href: "/notes/", label: "Transmissions", hint: "Writing, experiments and podcast episodes.", fig: "flask", color: "blue" },
  { n: 4, href: "/record/", label: "On the record", hint: "Bylines and quotes, earned media, research citations.", fig: "press", color: "pink" },
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
  image: { src: "/products/mediacontext-publishers.webp", alt: "MediaContext Publishers view: premium publishers ranked by traffic, with sales house, ad formats, header bidding and ad density per account." },
  href: "https://mediacontext.dev",
  cta: "Book a MediaContext call",
};

export const FDM = {
  title: "A senior marketer, deployed inside your team.",
  lede: "Forward deployed engineers sit with the customer until the software works. I do the same for growth: at least three months inside your team, finding what holds growth back and building the fix.",
  offer: {
    name: "Growth transformation",
    label: "Monthly retainer",
    price: "$4,995",
    term: "/ month",
    commitment: "Three-month minimum",
    for: "For a media or adtech company whose product has outgrown its positioning, website and pipeline.",
    cta: "Book a scoping call",
  },
  capabilities: [
    { name: "Positioning & websites", work: "A clear product story and a website that helps buyers take the next step." },
    { name: "Organic growth", work: "SEO, AI search visibility, and content built around relevant buyer questions." },
    { name: "GTM engineering & agents", work: "Account research, CRM workflows, and AI agents that turn a recurring task into a measurable workflow." },
  ],
  process: "We'll discuss what needs to change, confirm fit and budget, and identify the first piece of work. If there's a fit, you'll receive a defined scope and next steps.",
};

export const TESTIMONIALS = [
  { quote: "VJ brought a thoughtful approach to the UX, positioning, and messaging during the site redesign process, and a much-needed 'been-there-done-that' perspective to many parts of our business.", author: "Scott Konopasek", role: "Co-founder & COO, Filament" },
  { quote: "VJ is the best B2B marketer I've worked with. I'd recommend him to anyone looking for a marketing leader who thrives in early-stage chaos.", author: "Marty Kratky-Katz", role: "Exited tech founder" },
  { quote: "VJ's eye for design and details with the ability to look at the big picture was unlike any I've seen before.", author: "Shubham Grover", role: "Founder, Assist" },
  { quote: "VJ has an uncanny ability to say the most complex things in the most simple manner.", author: "Sudhiranjan Bannerjee", role: "Senior Trade Officer, Govt. of Alberta" },
];

// Press data, ported verbatim from the archived site's portfolio.json.
// Bylines that only exist as dead wp-content PDFs are left unlinked on purpose.
export const PRESS = {
  bylines: [
    { title: "Abiogenesis: How life emerged in a non-living world", source: "Digit" },
    { title: "The mysteries of time travel explained", source: "Digit" },
    { title: "Consumer Attitudes Toward Digital Advertising 2021", source: "eMarketer", href: "https://www.emarketer.com/content/consumer-attitudes-toward-digital-advertising-2021" },
    { title: "Chinese investments in Indian startups skyrocket", source: "China-India Dialogue" },
    { title: "'It can be a money-printing machine': The revival of auto-refreshing ads", source: "Digiday", href: "https://digiday.com/media/can-money-printing-machine-incredible-revival-auto-refreshing-ads/" },
    { title: "Facebook's not listening to you, its new ad disclosure feature screams", source: "TNW", href: "https://thenextweb.com/news/facebooks-totally-not-listening-to-you-its-new-ad-disclosure-feature-screams-desperately" },
    { title: "Google Chrome's policy change won't stop targeted ads", source: "ConsumerAffairs", href: "https://www.consumeraffairs.com/news/google-chromes-recent-privacy-policy-change-wont-stop-targeted-ads-030821.html" },
    { title: "10 UX tools marketers need to know about", source: "MarketingProfs", href: "https://www.marketingprofs.com/articles/2015/27842/10-user-experience-testing-tools-marketers-need-to-know-about" },
    { title: "Advertising's Gen Z obsession misses the bigger picture", source: "ExchangeWire", href: "https://www.exchangewire.com/blog/2025/08/13/advertisings-gen-z-obsession-misses-the-bigger-picture/" },
  ],
  earnedMedia: [
    { title: "How CafeMedia recouped millions through adblock recovery", source: "Adweek", href: "https://www.adweek.com/programmatic/how-cafemedia-recouped-millions-through-ad-block-recovery/" },
    { title: "How AccuWeather shored up revenue with ad-blocking audience", source: "AdExchanger", href: "https://www.adexchanger.com/online-advertising/how-accuweather-shored-up-revenue-by-monetizing-its-ad-blocking-audience/" },
    { title: "Publishers forecast to lose $54B in revenue from ad-blocking", source: "MediaPost", href: "https://www.mediapost.com/publications/article/391246/publishers-forecast-to-lose-54b-in-revenue-from-a.html" },
    { title: "Desktop Ad-Blocking Creeps Up, PageFair Reports", source: "MediaPost", href: "https://www.mediapost.com/publications/article/375795/desktop-ad-blocking-creeps-up-pagefair-reports.html" },
    { title: "Blockthrough co-founder looks at the future of ad blocking", source: "MediaPost", href: "https://www.mediapost.com/publications/article/379540/blockthrough-co-founder-looks-at-the-future-of-ad.html" },
    { title: "Why ad block users are not all 'militant ad haters'", source: "The Media Leader", href: "https://the-media-leader.com/why-ad-block-users-are-not-all-militant-ad-haters/" },
    { title: "Ad blocking surges as millions more seek privacy, less annoyance", source: "TechCrunch / CNET", href: "https://www.cnet.com/news/privacy/ad-blocking-surges-as-millions-more-seek-privacy-security-and-less-annoyance/" },
    { title: "Working with web publishers, this startup has notched up $10M ARR", source: "YourStory", href: "https://yourstory.com/2020/01/startup-adtech-saas-ad-pushup-web-publishers" },
  ],
  citations: [
    { title: "Consumer privacy choices and (un) targeted advertising along the purchase journey", source: "Journal of Marketing Research", year: "2023", href: "https://doi.org/10.1177/00222437221140052" },
    { title: "The Antitrust Assault on Ad Tech: A Law & Economics Critique", source: "ICLE White Paper", year: "2022", href: "https://laweconcenter.org/icle-white-paper-critiques-the-antitrust-assault-on-ad-tech/" },
    { title: "'Times They Are a Changin' — Can the Ad Tech Industry Survive in a Privacy Conscious World?", source: "Catholic University Journal of Law & Technology", year: "2021", href: "https://scholarship.law.edu/jlt/vol30/iss1/7" },
    { title: "A Longitudinal Analysis of the ads.txt Standard", source: "Internet Measurement Conference Proceedings", year: "2019", href: "https://dl.acm.org/doi/10.1145/3355369.3355603" },
    { title: "Eluding ml-based adblockers with actionable adversarial examples", source: "37th Annual Computer Security Applications Conference", year: "2021", href: "https://dl.acm.org/doi/10.1145/3485832.3488008" },
    { title: "Fake news: The commoditization of internet speech", source: "California Western International Law Journal", year: "2017", href: "https://scholarlycommons.law.cwsl.edu/cwilj/vol48/iss1/5" },
    { title: "Development of an Asynchronous Mobile game", source: "Master's thesis, Universidade de Coimbra", year: "", href: "https://hdl.handle.net/10316/92555" },
  ],
  authorArchives: [
    { name: "Forbes Communications Council", href: "https://www.forbes.com/councils/forbescommunicationscouncil/people/vishveshwarjatain/" },
    { name: "Digital Content Next", href: "https://digitalcontentnext.org/blog/author/vishveshwar/" },
    { name: "Blockthrough", href: "https://blockthrough.com/blog/author/vjblockthrough-com/" },
  ],
  reports: [
    { name: "PageFair Adblock Reports", role: "Editor & Researcher", body: "Editor (20/21/22/24), researcher & publisher of the industry-standard annual report on ad blocking trends.", href: "https://blockthrough.com/blog/category/reports/" },
  ],
  podcast: [
    { name: "Slice of AdTech Podcast", role: "Host & Producer", body: "Host & producer of a podcast exploring the ad tech ecosystem.", href: "https://sliceofadtech.buzzsprout.com/2043731/episodes" },
  ],
  investments: [
    { name: "The Fort Distillery", location: "SK", description: "A craft spirits company producing premium gin, vodka, and whisky in Fort Qu'Appelle, Saskatchewan.", href: "https://thefortdistillery.com/" },
    { name: "VoltSafe", location: "BC", description: "A magnetic electrical connection technology company replacing traditional prong-based plugs with safer, smarter alternatives.", href: "https://voltsafe.com/" },
  ],
};

export const RECORD = {
  title: "Bylines, coverage and reports.",
  lede: "Bylines and quotes in the trade press, earned media, research citations, reports, a podcast and investments.",
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
