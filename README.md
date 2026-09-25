# SOMOS

Mobile-first PWA for learning Mexican Spanish from Slovak. Full spec: [CLAUDE.md](CLAUDE.md).

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (Node 24) |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run dev -- --host` | Dev server reachable from a phone on the same Wi-Fi |
| `npm run build` | Type-check + production build into `dist/` (incl. service worker) |
| `npm run preview` | Serve the production build locally (http://localhost:4173) |
| `npm run lint` | Lint with oxlint |
| `npm run icons` | Regenerate app icons from `scripts/generate-icons.ts` |

Deployed on Vercel (Vite preset, output `dist`); `vercel.json` adds the SPA rewrite.
