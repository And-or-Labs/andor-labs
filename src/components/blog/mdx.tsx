import type { ReactNode } from "react";
import { cn } from "@andor/ds";

// Components available inside every blog MDX file. Mapped in pages/blog/[...slug].astro.

export function Figure({ src, alt, caption, credit }: { src: string; alt: string; caption?: string; credit?: string }) {
  return (
    <figure className="not-prose my-10">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full rounded-xl shadow-[0_0_0_1px_var(--border)]" />
      {(caption || credit) && (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          {caption}
          {credit && <span className="font-label text-[10px] uppercase tracking-[0.08em]"> {caption ? "· " : ""}{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

const tones: Record<string, string> = {
  note: "bg-muted shadow-[inset_3px_0_0_var(--marker-1)]",
  tip: "bg-muted shadow-[inset_3px_0_0_var(--marker-3)]",
  warning: "bg-muted shadow-[inset_3px_0_0_var(--marker-2)]",
};

export function Callout({ tone = "note", title, children }: { tone?: string; title?: string; children: ReactNode }) {
  return (
    <aside className={cn("not-prose my-8 rounded-xl px-6 py-5 text-[15px] leading-relaxed [&_p+p]:mt-3 [&_a]:underline", tones[tone] ?? tones.note)}>
      {title && <p className="mb-2 font-semibold">{title}</p>}
      {children}
    </aside>
  );
}

export function KeyStat({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="not-prose my-10 border-y py-6">
      <p className="text-5xl font-semibold tracking-[-0.04em] tabular-nums text-primary">{value}</p>
      <p className="mt-2 text-lg">{label}</p>
      {source && <p className="mt-2 font-label text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Source: {source}</p>}
    </div>
  );
}

export function PullQuote({ attribution, children }: { attribution?: string; children: ReactNode }) {
  return (
    <figure className="not-prose my-10">
      <blockquote className="text-2xl font-semibold leading-snug tracking-[-0.02em] md:text-[1.75rem]">{children}</blockquote>
      {attribution && <figcaption className="mt-3 text-sm text-muted-foreground">{attribution}</figcaption>}
    </figure>
  );
}
