# PaperGrab Change Logs

This file records project changes for Lan-Jingbo and future coding agents. Read it after `PROJECT_CONTEXT.md` when you need a quick history of what changed and why.

## 2026-06-18

### Add Cat-Inspired Product Logo

- Added `public/papergrab-logo.svg`, inspired by the user's reference cat.
- Replaced the header book icon with the new PaperGrab logo.
- Added the SVG as the web app favicon in `index.html`.
- Verified the SVG renders and the production site serves it correctly.

Commit: `99122e0 Add cat-inspired product logo`

### Add Optional Google Scholar Source

- Added Google Scholar as an optional backend source through SerpAPI JSON.
- Uses `SERPAPI_API_KEY` or `SERP_API_KEY` when configured.
- Skips Google Scholar safely when no key exists, avoiding direct Scholar HTML scraping and saving tokens.
- Updated project context and coding rules with the optional-source behavior.

Commit: `bcb1c3e Add optional Google Scholar source`

### Skip Unreachable PDF Links

- Added lightweight PDF availability checks before returning candidate papers.
- Uses bounded HEAD requests and partial GET fallback only when needed.
- Skips clear Cloudflare `523 origin is unreachable` PDF links.
- Added an availability action in API responses so users and agents can see skipped links.

Commit: `3fc4b9b Skip unreachable PDF links`

### Refine Research UI And Project Structure

- Simplified the interface toward a ChatGPT/Manus-style layout.
- Reordered result sections so PDFs appear first, then research plan/advice, then reference list.
- Split app code out of `main.jsx` into `App.jsx`, `src/components/`, and `src/api/`.
- Added `PROJECT_CONTEXT.md` and `CODING_RULES.md` to reduce future context/token usage.

Commit: `4ad9f09 Refine research UI and project structure`

### Add AI-Driven Paper Browsing

- Replaced prepared sample papers with AI-driven search planning and source browsing.
- Added Netlify Function `/api/search`.
- Integrated compact academic metadata sources including Semantic Scholar, arXiv, OpenAlex, and Crossref.
- Added ranked paper results, PDF links, APA references, and research advice.

Commit: `ba039f0 Add AI-driven paper browsing`

### Build Initial PaperGrab React App

- Created the first React/Vite PaperGrab app.
- Added the initial chat-style research topic input.
- Added paper result display and reference formatting workflow.

Commit: `981ea7d Build PaperGrab React app`

## Repository Notes

- GitHub remote should stay under `Lan-Jingbo/PaperGrab`.
- Push future GitHub updates from the `Lan-Jingbo` account, not `Jerry-Lan14`.
- Local project path: `/Users/lanjingbo/Desktop/Self-Build/PaperGrab`.
