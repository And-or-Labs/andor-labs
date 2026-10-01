import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    standfirst: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(["field-notes", "resources", "explainer"]).default("field-notes"),
    author: z.string().default("Vishveshwar Jatain"),
    heroImage: z.string().optional(),
    heroAlt: z.string().default(""),
    heroCredit: z.string().optional(),
    keyTakeaways: z.array(z.string()).optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
    tags: z.array(z.string()).optional(),
    noIndex: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { blog };
