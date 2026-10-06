import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

import { SITE } from "../data/site";

export async function GET(context) {
  const posts = (await getCollection("blog", p => !p.data.draft)).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: "And/or Labs lab notes",
    description: "Experiments and field notes on GTM, AI and the post-software era.",
    site: context.site ?? SITE.url,
    items: posts.map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/notes/${post.id}/`,
    })),
  });
}
