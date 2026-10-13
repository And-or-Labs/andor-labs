// Dev-only feedback overlay. Annotations sync to the local agentation server on :4747.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";

const el = document.createElement("div");
el.id = "agentation-root";
document.body.appendChild(el);
createRoot(el).render(createElement(Agentation, { endpoint: "http://localhost:4747" }));
// ClientRouter swaps <body>; carry the overlay and its portal across each navigation.
let keep: Element[] = [];
document.addEventListener("astro:before-swap", () => { keep = [el, ...document.querySelectorAll("[data-agentation-portal]")]; });
document.addEventListener("astro:after-swap", () => { for (const n of keep) if (!n.isConnected) document.body.appendChild(n); });
