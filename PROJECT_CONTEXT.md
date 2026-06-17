# PaperGrab Project Context

Read this file first before making changes.

## Purpose

PaperGrab is a React + Netlify web app for researchers. The user describes a research topic, and the app browses compact scholarly sources to return:

1. Open PDF paper links
2. Research advice and a research plan
3. APA-style reference list

## Current Product Direction

- UI should feel simple and calm, closer to ChatGPT or Manus AI than a dense dashboard.
- Results order matters: PDFs first, research plan/advice second, reference list last.
- The app should avoid scraping full webpages when structured scholarly APIs are enough.
- The backend follows an ActionBook-style idea: plan bounded actions, browse compact endpoints, extract only useful metadata.
- Before returning candidate PDFs, the backend runs a lightweight availability check and skips clear Cloudflare 523 / origin-unreachable links to avoid wasting tokens on dead sources.
- Google Scholar is optional through SerpAPI JSON (`SERPAPI_API_KEY` or `SERP_API_KEY`). If the key is absent, the app records a skipped action and does not scrape Google Scholar HTML.

## Stack

- React with Vite
- Netlify Functions at `netlify/functions/search.ts`
- Netlify deploy target: `papergrab`
- GitHub repo: `Lan-Jingbo/PaperGrab`
- Optional env: `SERPAPI_API_KEY` enables Google Scholar results through SerpAPI.

## Important Files

- `src/main.jsx`: React entry only
- `src/App.jsx`: app state and page composition
- `src/components/`: UI sections
- `src/api/papers.js`: frontend API helper
- `src/styles.css`: shared UI styling
- `netlify/functions/search.ts`: search planning, source browsing, ranking, research advice
- `CODING_RULES.md`: local rules for future changes

## Local Commands

```bash
npm install
npm run build
```

Netlify local functions may require a newer Node version than the system default. Production uses `.nvmrc` / `package.json` Node settings.
