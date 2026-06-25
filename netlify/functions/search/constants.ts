export const SOURCE_MANUALS = {
  semantic:
    "Semantic Scholar action manual: call Graph API with title/authors/year/abstract/openAccessPdf only; never fetch result pages unless metadata is missing.",
  arxiv:
    "arXiv action manual: call Atom API with compact all:term queries; use returned pdf link and abstract summary; retry shorter high-signal queries.",
  openalex:
    "OpenAlex action manual: search OA works with is_oa=true; read primary_location and best_oa_location for PDF/landing URLs.",
  crossref:
    "Crossref action manual: query works metadata for DOI/reference details; use PDF links only when the metadata exposes them directly.",
  scholar:
    "Google Scholar action manual: use a compact JSON proxy only when SERPAPI_API_KEY is configured; never scrape Scholar HTML pages.",
  university:
    "University Sites action manual: use SerpAPI Google JSON for compact site:.edu/site:.ac.uk/site:edu.cn searches; never crawl university websites directly.",
};

export const METHOD_WORDS = new Set([
  "algorithm",
  "algorithms",
  "analysis",
  "approach",
  "applying",
  "deep",
  "evaluation",
  "classification",
  "data",
  "learning",
  "machine",
  "model",
  "models",
  "neural",
  "prediction",
  "retrieval",
  "survey",
  "technique",
  "techniques",
]);

export const GENERIC_DOMAIN_WORDS = new Set(["system", "systems"]);

export const STOP_WORDS = new Set([
  "about",
  "academic",
  "also",
  "and",
  "any",
  "apply",
  "can",
  "discover",
  "find",
  "for",
  "give",
  "help",
  "how",
  "into",
  "need",
  "paper",
  "papers",
  "please",
  "reference",
  "references",
  "research",
  "researcher",
  "should",
  "that",
  "the",
  "their",
  "them",
  "these",
  "this",
  "want",
  "web",
  "webpage",
  "websites",
  "with",
]);
