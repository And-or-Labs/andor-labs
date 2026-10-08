import { navigate } from "astro:transitions/client";
import "./consent";

import { trackSiteEvent } from "./analytics";
import { mountFigure, type FigName } from "./figure";

type Figure = ReturnType<typeof mountFigure>;
let figure: Figure | null = null;
const ORIGIN_KEY = "andor:fig-origin";

const getFigure = () => {
  const canvas = document.getElementById("figure") as HTMLCanvasElement | null;
  if (canvas && !figure) figure = mountFigure(canvas);
  return figure;
};

const rememberOrigin = (el: Element) => {
  const r = el.getBoundingClientRect();
  try { sessionStorage.setItem(ORIGIN_KEY, JSON.stringify({ clientY: r.top + r.height / 2 })); } catch { /* storage disabled */ }
};
const takeOrigin = () => {
  try { const v = sessionStorage.getItem(ORIGIN_KEY); sessionStorage.removeItem(ORIGIN_KEY); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
};

function wireMenu() {
  const items = [...document.querySelectorAll<HTMLAnchorElement>(".menu a[data-fig]")];
  if (!items.length) return;
  let leaveTimer = 0;
  let enterTimer = 0;
  const enter = (a: HTMLAnchorElement, intent = 0) => {
    clearTimeout(leaveTimer); clearTimeout(enterTimer);
    items.forEach(x => x.classList.toggle("on", x === a));
    enterTimer = window.setTimeout(() => {
      const r = a.getBoundingClientRect();
      getFigure()?.preview(a.dataset.fig as FigName, { clientY: r.top + r.height / 2 });
    }, intent);
  };
  const leave = () => {
    clearTimeout(leaveTimer); clearTimeout(enterTimer);
    leaveTimer = window.setTimeout(() => {
      items.forEach(x => x.classList.remove("on"));
      getFigure()?.preview(null);
    }, 140);
  };
  for (const a of items) {
    a.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") enter(a, 90); });
    a.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") leave(); });
    a.addEventListener("focus", () => enter(a));
    a.addEventListener("blur", leave);
    a.addEventListener("click", () => rememberOrigin(a));
  }
}

function wireSubscribe() {
  document.querySelectorAll<HTMLFormElement>("form[data-subscribe]").forEach(form => {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const out = form.parentElement?.querySelector("output");
      const input = form.querySelector("input");
      const button = form.querySelector("button");
      if (!input || !out || !button) return;
      if (button.disabled) return;
      out.className = ""; out.textContent = "Sending...";
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      try {
        const res = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: input.value, source: form.dataset.subscribe }), signal: AbortSignal.timeout(12000) });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok === true) {
          out.className = "ok"; out.textContent = "Subscribed. New notes only, weekly at most.";
          trackSiteEvent("newsletter_subscribed", { placement: form.dataset.subscribe });
          form.reset();
        }
        else { out.className = "err"; out.textContent = data.error || "That didn't go through. Try again?"; }
      } catch { out.className = "err"; out.textContent = "Network hiccup. Try again?"; }
      button.disabled = false;
      form.removeAttribute("aria-busy");
    });
  });
}

let printedRO: ResizeObserver | null = null;
function wirePrinted() {
  printedRO?.disconnect(); printedRO = null;
  const el = document.querySelector<HTMLElement>(".printed");
  if (!el) return;
  // Fade the right edge only while there is more list off to the right.
  const update = () => {
    el.toggleAttribute("data-overflow", el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  };
  printedRO = new ResizeObserver(update);
  printedRO.observe(el);
  el.addEventListener("scroll", update, { passive: true });
  update();
  document.fonts?.ready.then(update);
}

function wireShare() {
  document.querySelectorAll<HTMLButtonElement>("[data-copy-link]").forEach(b => {
    b.addEventListener("click", async () => {
      const note = b.parentElement?.querySelector(".copied");
      try { await navigator.clipboard.writeText(location.href); if (note) note.textContent = "Link copied"; }
      catch { if (note) note.textContent = "Copy failed"; }
      setTimeout(() => { if (note) note.textContent = ""; }, 1800);
    });
  });
}

document.addEventListener("astro:page-load", () => {
  const main = document.getElementById("main");
  getFigure()?.set((main?.dataset.fig || "ripple") as FigName, takeOrigin());
  wireMenu();
  wireSubscribe();
  wireShare();
  wirePrinted();
});

document.addEventListener("click", e => {
  const a = (e.target as Element).closest?.("a[data-back], .crumb");
  if (a) rememberOrigin(a);
});

document.addEventListener("keydown", e => {
  const t = e.target as HTMLElement;
  if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || t.matches("input, textarea, select")) return;
  if (e.key === "Escape") {
    const back = document.querySelector<HTMLAnchorElement>("a[data-back]");
    if (back) { rememberOrigin(back); navigate(back.href); }
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    const target = document.querySelector<HTMLAnchorElement>(`.menu a[data-n="${e.key}"]`) ?? document.querySelector<HTMLAnchorElement>(`[data-menu-key="${e.key}"]`);
    if (target) { rememberOrigin(target); navigate(target.href); }
  }
});
