// Every piece of copy on the site, in one place.
// Sources: VJ's Homepage v2 note, the October 2026 long-form build (08891d2:src/data/site.ts),
// the MediaContext / Megafly / zero-click READMEs, and CV_VJ_Mozilla_Firefox.md
// for Blockthrough and AdPushup career results. Claims rule: VJ led marketing and
// sales ops at Blockthrough and AdPushup through their acquisitions. He did not found or exit them.

export const BOOKING_URL = "https://cal.com/jatain/book";
export const EMAIL = "vj@andorlabs.ca";

export const SITE = {
  name: "And/or Labs",
  url: "https://andorlabs.ca",
  title: "And/or Labs | We engineer growth for media & adtech companies",
  description:
    "We engineer growth for media & adtech companies. We build MediaContext, run fixed-price GTM packages, and publish field notes.",
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

export const MENU: { n: number; href: string; label: string; hint: string; fig: Fig; color: Color }[] = [
  { n: 1, href: "/mediacontext/", label: "MediaContext", hint: "Our product. Market intelligence for the premium open web.", fig: "radar", color: "blue" },
  { n: 2, href: "/gtm/", label: "GTM Packages", hint: "Senior GTM experience and hands-on delivery. Two fixed prices.", fig: "growth", color: "coral" },
  { n: 3, href: "/notes/", label: "Writing", hint: "Field notes, bylines and coverage in Digiday, Adweek, AdExchanger and others.", fig: "notes", color: "lilac" },
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
  title: "Senior GTM experience. Hands-on delivery.",
  lede: "I help adtech companies improve how they present their products, attract buyers, and run their marketing. Positioning, websites, organic growth, and custom automation, with the strategy and implementation handled together.",
  founder: "I led marketing and sales operations at Blockthrough and AdPushup through their acquisitions. At And/or Labs, you work directly with me.",
  experience: [
    { company: "Blockthrough", role: "Director, Marketing & Sales Operations", result: "3× organic traffic", work: "Built and led the marketing and revenue operations team. Ran search experiments, research-led campaigns, and brand modernization." },
    { company: "AdPushup", role: "Product Marketing Manager", result: "50k+ monthly visits", work: "Built a content engine spanning 150+ articles, email courses, and webinars, alongside CRM and account-based marketing work." },
  ],
  capabilities: [
    { name: "Positioning & websites", work: "A clear product story and a website that helps buyers take the next step." },
    { name: "Organic growth", work: "SEO, AI search visibility, and content built around relevant buyer questions." },
    { name: "GTM engineering", work: "Account research, CRM workflows, and automation that improve follow-through." },
    { name: "Custom AI agents", work: "A recurring marketing task turned into a deployed, measurable workflow." },
  ],
  offers: [
    { id: "copilot", name: "GTM Copilot", label: "Ongoing implementation", price: "$4,995", term: "/ month", commitment: "Initial three-month engagement", headline: "A senior operator who also builds.", for: "For a company with customers and important marketing work that isn't getting shipped.", description: "We agree on the most important problem, define the first deliverable, and get to work. The roadmap can include your website, SEO/AEO, account research, CRM workflows, and custom AI agents.", scope: ["One major implementation initiative at a time", "Priorities and progress reviewed regularly", "First-month deliverable, capacity, and responsibilities agreed before signing"], cta: "Discuss Copilot" },
    { id: "refresh", name: "Website & Positioning Refresh", label: "Fixed-scope project", price: "$9,995", term: "/ project", commitment: "Scope and schedule agreed before kickoff", headline: "Bring your website up to the standard of your product.", for: "For a company whose website no longer reflects the quality of its product.", description: "Positioning, design, and implementation in one engagement. A clear product story, a cohesive site, and a foundation your team can maintain.", scope: ["Positioning, responsive design, and implementation", "Analytics and a maintainable handoff", "Pages, content, functionality, revisions, and delivery schedule agreed before signing"], cta: "Discuss a refresh" },
  ],
  caseStudy: { client: "Filament", line: "A WordPress site rebuilt as a Next.js brand in nine days.", metrics: ["9 days", "100 Lighthouse SEO", "1.09s LCP"], href: "https://www.wearefilament.com" },
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

export const NOTES = {
  title: "Field notes, bylines and coverage.",
  lede: "Working notes, operator playbooks, and post-mortems. No growth-hacking listicles.",

};
