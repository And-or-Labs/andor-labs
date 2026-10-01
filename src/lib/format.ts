export const formatDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 230));
