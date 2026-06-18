# Paper Finding Skill

Use this skill when PaperGrab/aCATamic needs to find academic references from a user's research request.

## Goal

Return useful papers with PDF links first, then research planning advice, while keeping browsing compact and token-efficient.

## Workflow

1. Read the user's request and turn it into 3-5 concise scholarly search queries.
2. Search structured academic sources before browsing webpages:
   - Semantic Scholar Graph API for title, authors, abstract, venue, DOI, and open PDF.
   - arXiv Atom API for preprints and direct PDF links.
   - OpenAlex works API for open-access metadata and PDF locations.
   - Crossref works API for DOI/reference metadata and exposed PDF links.
3. Use optional SerpAPI sources only when `SERPAPI_API_KEY` or `SERP_API_KEY` is configured:
   - Google Scholar through SerpAPI Google Scholar JSON.
   - University Sites through SerpAPI Google JSON with compact `site:.edu`, `site:.ac.uk`, and `site:edu.cn` queries.
4. Never scrape Google Scholar HTML or crawl university websites directly.
5. Rank and deduplicate papers by DOI/title, topic matches, PDF availability, and recency.
6. Check candidate PDF URLs with bounded HEAD/partial GET requests.
7. Skip clear Cloudflare 523 / origin-unreachable PDF links.
8. Return each paper with its own APA-style reference, source link, and PDF link when available.
9. Build a compact research plan and advice from the request and top returned paper titles.

## Output Priorities

1. PDF papers
2. Research plan and advice
3. Per-paper reference format

## Future Extensions

Add discipline-specific skill files in this directory, for example:

- `astrophysics.md`
- `social-science.md`
- `biology.md`
- `computer-science.md`
