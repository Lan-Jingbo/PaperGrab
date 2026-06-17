import type { Config, Context } from "@netlify/functions";
import { XMLParser } from "fast-xml-parser";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  doi?: string;
  pdfUrl?: string;
  sourceUrl?: string;
  source: "Semantic Scholar" | "arXiv";
  reference: string;
};

type SemanticPaper = {
  paperId?: string;
  title?: string;
  abstract?: string;
  year?: number;
  venue?: string;
  url?: string;
  authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; ArXiv?: string };
  openAccessPdf?: { url?: string };
  citationStyles?: { bibtex?: string };
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Use POST with a JSON body containing a query." }, 405);
  }

  let query = "";
  try {
    const body = await req.json();
    query = String(body.query || "").trim();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (query.length < 4) {
    return json({ error: "Please describe the research topic in a little more detail." }, 400);
  }

  const [semanticResult, arxivResult] = await Promise.allSettled([
    searchSemanticScholar(query),
    searchArxiv(query),
  ]);

  const semanticPapers = semanticResult.status === "fulfilled" ? semanticResult.value : [];
  const arxivPapers = arxivResult.status === "fulfilled" ? arxivResult.value : [];
  if (semanticResult.status === "rejected") console.error("Semantic Scholar search failed", semanticResult.reason);
  if (arxivResult.status === "rejected") console.error("arXiv search failed", arxivResult.reason);
  const papers = dedupe([...semanticPapers, ...arxivPapers])
    .filter((paper) => paper.pdfUrl)
    .slice(0, 8);

  const fallback = papers.length === 0 ? dedupe([...semanticPapers, ...arxivPapers]).slice(0, 8) : papers;
  const pdfCount = fallback.filter((paper) => paper.pdfUrl).length;

  return json({
    query,
    summary:
      fallback.length > 0
        ? `Found ${fallback.length} candidate papers. ${pdfCount} include direct open-access PDF links.`
        : "No papers were found. Try a more specific method, domain, or phrase.",
    papers: fallback,
  });
};

export const config: Config = {
  path: "/api/search",
};

async function searchSemanticScholar(query: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    limit: "8",
    fields: "title,authors,year,abstract,url,venue,externalIds,openAccessPdf,citationStyles",
  });
  const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: SemanticPaper[] };

  return (payload.data || []).map((item) => {
    const authors = cleanAuthors(item.authors?.map((author) => author.name || "") || []);
    const doi = item.externalIds?.DOI;
    const pdfUrl = item.openAccessPdf?.url || arxivPdfFromId(item.externalIds?.ArXiv);
    const paper: Paper = {
      id: item.paperId || item.url || item.title || crypto.randomUUID(),
      title: cleanText(item.title || "Untitled paper"),
      authors,
      year: item.year,
      venue: item.venue,
      abstract: truncate(cleanText(item.abstract || ""), 720),
      doi,
      pdfUrl,
      sourceUrl: item.url || doiUrl(doi),
      source: "Semantic Scholar",
      reference: "",
    };
    paper.reference = formatApa(paper);
    return paper;
  });
}

async function searchArxiv(query: string): Promise<Paper[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9.-]/g, ""))
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word))
    .slice(0, 10);

  const variants = [terms, terms.slice(0, 6), terms.slice(0, 4)]
    .filter((variant) => variant.length > 0)
    .map((variant) => variant.map((word) => `all:${encodeURIComponent(word)}`).join("+AND+"));

  for (const search of variants) {
    const response = await fetch(
      `https://export.arxiv.org/api/query?search_query=${search}&start=0&max_results=8&sortBy=relevance&sortOrder=descending`,
      { headers: { Accept: "application/atom+xml" } },
    );

    if (!response.ok) continue;

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });
    const feed = parser.parse(xml).feed;
    const entries = Array.isArray(feed?.entry) ? feed.entry : feed?.entry ? [feed.entry] : [];

    if (entries.length > 0) {
      return entries.map((entry: any) => {
        const authors = cleanAuthors(
          (Array.isArray(entry.author) ? entry.author : [entry.author])
            .filter(Boolean)
            .map((author: { name?: string }) => author.name || ""),
        );
        const links = Array.isArray(entry.link) ? entry.link : [entry.link].filter(Boolean);
        const pdfUrl = links.find((link: { title?: string; href?: string }) => link.title === "pdf")?.href;
        const year = entry.published ? Number(String(entry.published).slice(0, 4)) : undefined;
        const paper: Paper = {
          id: entry.id || entry.title || crypto.randomUUID(),
          title: cleanText(entry.title || "Untitled arXiv paper"),
          authors,
          year,
          abstract: truncate(cleanText(entry.summary || ""), 720),
          pdfUrl,
          sourceUrl: entry.id,
          source: "arXiv",
          reference: "",
        };
        paper.reference = formatApa(paper);
        return paper;
      });
    }
  }

  return [];
}

function dedupe(papers: Paper[]) {
  const seen = new Set<string>();
  const unique: Paper[] = [];

  for (const paper of papers) {
    const key = (paper.doi || paper.title).toLowerCase().replace(/\W+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(paper);
  }

  return unique;
}

function cleanAuthors(authors: string[]) {
  const cleaned = authors.map(cleanText).filter(Boolean);
  return cleaned.length > 0 ? cleaned.slice(0, 8) : ["Unknown author"];
}

function formatApa(paper: Paper) {
  const authors = formatAuthors(paper.authors);
  const year = paper.year || "n.d.";
  const venue = paper.venue ? ` ${paper.venue}.` : "";
  const link = paper.doi ? ` https://doi.org/${paper.doi}` : paper.sourceUrl ? ` ${paper.sourceUrl}` : "";
  return `${authors} (${year}). ${paper.title}.${venue}${link}`.replace(/\s+/g, " ").trim();
}

function formatAuthors(authors: string[]) {
  if (authors.length === 0 || authors[0] === "Unknown author") return "Unknown author.";
  const formatted = authors.map((name) => {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return name;
    const family = parts.pop();
    const initials = parts.map((part) => `${part[0].toUpperCase()}.`).join(" ");
    return `${family}, ${initials}`;
  });
  if (formatted.length === 1) return `${formatted[0]}.`;
  if (formatted.length > 6) return `${formatted.slice(0, 6).join(", ")}, et al.`;
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}.`;
}

function arxivPdfFromId(id?: string) {
  return id ? `https://arxiv.org/pdf/${id}` : undefined;
}

function doiUrl(doi?: string) {
  return doi ? `https://doi.org/${doi}` : undefined;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "apply",
  "can",
  "for",
  "how",
  "in",
  "into",
  "of",
  "on",
  "or",
  "paper",
  "papers",
  "reference",
  "references",
  "research",
  "researcher",
  "that",
  "the",
  "their",
  "to",
  "using",
  "want",
  "we",
  "with",
]);
