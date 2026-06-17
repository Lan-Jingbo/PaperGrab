# PaperGrab

PaperGrab is a small React app that helps researchers ask for reference papers in plain language, then returns open-access PDF links and formatted references.

It follows the ActionBook-style principle of using structured actions before expensive browsing: direct scholarly APIs first, compact metadata, and PDF/source links instead of scraping full webpages.

The search function uses an AI planner when Netlify AI Gateway or an OpenAI-compatible `OPENAI_BASE_URL`/`OPENAI_API_KEY` is available. Without those variables it falls back to a deterministic planner, while still browsing scholarly endpoints through the same compact action manuals.

## Local Development

```bash
npm install
npm run netlify:dev
```

## Build

```bash
npm run build
```
