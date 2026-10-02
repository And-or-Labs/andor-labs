# MegaFly / by and/or labs

A Three.js fly at a laptop, a computed MaleCNS neural replay, and an inspectable Jev request/response. Uses the design tokens and local fonts from `../andor-labs`.

```bash
npm install
npm run dev
npm run build
```

## What runs

- `public/data/locomotor-circuit.json`: DesktopFly's MaleCNS v1.0 extract, 1,045 neurons and 17,224 measured directed connections. CC BY 4.0; source hashes and attribution are in the adjacent provenance/license files. Credit the MaleCNS collaboration (FlyEM/HHMI Janelia, Cambridge, MRC LMB, Google Research) and Denis Shiryaev's DesktopFly extraction.
- `src/neural.ts`: deterministic, uncalibrated LIF model; 1 ms integration, 20 ms membrane time constant, three-step refractory period, explicit weight gain and engineered market stimulus. No biological trading or whole-brain claim. 12 model seconds are computed locally into 601 frames and replayed over 60 seconds. Raw events are grouped in 20 ms model-time bins. Soma display includes the 880 cells with measured positions; it samples edges for readability, while computation uses all retained connections.
- `src/jev.ts`: shared typed questions and budget-allocation policy. At 25 replay seconds, the input includes the computed five-second neural population summary. No token-by-token response or hidden reasoning is manufactured.
- `src/fly.ts` and `src/workstation.ts`: procedural body, typing animation, laptop, and paper trading scene. Typing is illustrative choreography, not biological motor output.
- The paper portfolio starts at $4,000 display, $3,500 video, $2,500 native. A 12% shift moves $480 from display to video, conserving $10,000. No returns or reward are fabricated.

## Record a real Jev call

There is no default decision. **Call Jev** sends a POST to `/api/jev/decision` on the Vite development or preview server, which calls Jev using a server-only credential. Missing keys and API errors block execution; there is no fixture fallback. No credential is sent to the browser. Static-only hosting needs an equivalent backend route.

```bash
cp .env.example .env
# Set TYPESAFE_API_KEY in .env, then:
npm run generate:trace
```

The generator loads `.env`, computes the same neural state, sends one request, and saves its exact SDK request, raw response, token usage, and measured call duration to ignored `public/jev-trace.json`. Reload the page to replay a recording with a successful HTTP transport receipt. Allocation percentages are code policy, not numeric reasoning by Jev. Legacy recordings without raw payloads and a successful transport receipt are rejected.

## Controls

Drag to orbit. Pause/restart, scrub, or select a process step. Copy the displayed input, share a timestamp link, or export a PNG. Reduced-motion preferences pause autoplay. Provenance is visible in the main panels and explained in the expandable note.
