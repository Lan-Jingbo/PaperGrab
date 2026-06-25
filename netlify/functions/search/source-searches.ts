import { XMLParser } from "fast-xml-parser";

import { arxivPdfFromId, cleanAuthors, cleanText, doiUrl, extractTerms, extractYear, formatApa, invertedAbstract, stripHtml, truncate } from "./formatting";
import { fetchWithTimeout, readEnv } from "./http";
import type { CrossrefWork, GoogleScholarResult, GoogleSearchResult, OpenAlexWork, Paper, SemanticPaper } from "./types";

export async function searchSemanticScholar(query: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    limit: "8",
    fields: "title,authors,year,abstract,url,venue,externalIds,openAccessPdf",
  });
  const response = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, {
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
      score: 0,
    };
    paper.reference = formatApa(paper);
    return paper;
  });
}

export async function searchArxiv(query: string): Promise<Paper[]> {
  const terms = extractTerms(query).slice(0, 10);
  const variants = [terms, terms.slice(0, 6), terms.slice(0, 4)]
    .filter((variant) => variant.length > 0)
    .map((variant) => variant.map((word) => `all:${encodeURIComponent(word)}`).join("+AND+"));

  for (const search of variants) {
    const response = await fetchWithTimeout(
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
          score: 0,
        };
        paper.reference = formatApa(paper);
        return paper;
      });
    }
  }

  return [];
}

export async function searchOpenAlex(query: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    search: query,
    filter: "is_oa:true",
    "per-page": "8",
    sort: "relevance_score:desc",
  });
  const response = await fetchWithTimeout(`https://api.openalex.org/works?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { results?: OpenAlexWork[] };

  return (payload.results || []).map((work) => {
    const doi = work.doi?.replace(/^https:\/\/doi.org\//, "");
    const authors = cleanAuthors(work.authorships?.map((item) => item.author?.display_name || "") || []);
    const paper: Paper = {
      id: work.id || work.doi || work.title || crypto.randomUUID(),
      title: cleanText(work.title || work.display_name || "Untitled OpenAlex work"),
      authors,
      year: work.publication_year,
      venue: work.primary_location?.source?.display_name,
      abstract: truncate(invertedAbstract(work.abstract_inverted_index), 720),
      doi,
      pdfUrl: work.primary_location?.pdf_url || work.best_oa_location?.pdf_url,
      sourceUrl: work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.id,
      source: "OpenAlex",
      reference: "",
      score: 0,
    };
    paper.reference = formatApa(paper);
    return paper;
  });
}

export async function searchCrossref(query: string): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    rows: "8",
    filter: "type:journal-article",
    sort: "relevance",
  });
  const response = await fetchWithTimeout(`https://api.crossref.org/works?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { message?: { items?: CrossrefWork[] } };

  return (payload.message?.items || []).map((work) => {
    const authors = cleanAuthors(work.author?.map((author) => `${author.given || ""} ${author.family || ""}`) || []);
    const pdfUrl = work.link?.find((link) => link["content-type"]?.includes("pdf"))?.URL;
    const paper: Paper = {
      id: work.DOI || work.URL || work.title?.[0] || crypto.randomUUID(),
      title: cleanText(work.title?.[0] || "Untitled Crossref work"),
      authors,
      year: work.published?.["date-parts"]?.[0]?.[0],
      venue: work["container-title"]?.[0],
      abstract: truncate(stripHtml(cleanText(work.abstract || "")), 720),
      doi: work.DOI,
      pdfUrl,
      sourceUrl: work.URL || doiUrl(work.DOI),
      source: "Crossref",
      reference: "",
      score: 0,
    };
    paper.reference = formatApa(paper);
    return paper;
  });
}

export async function searchGoogleScholar(query: string): Promise<Paper[]> {
  const apiKey = readEnv("SERPAPI_API_KEY") || readEnv("SERP_API_KEY");
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: "google_scholar",
    q: query,
    num: "8",
    api_key: apiKey,
  });
  const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { organic_results?: GoogleScholarResult[] };

  return (payload.organic_results || []).map((item) => {
    const authors = cleanAuthors(
      item.publication_info?.authors?.map((author) => author.name || "") || extractScholarAuthors(item.publication_info?.summary),
    );
    const pdfUrl = scholarPdfUrl(item.resources);
    const paper: Paper = {
      id: item.link || item.title || crypto.randomUUID(),
      title: cleanText(item.title || "Untitled Google Scholar result"),
      authors,
      year: extractYear(item.publication_info?.summary || ""),
      venue: scholarVenue(item.publication_info?.summary),
      abstract: truncate(cleanText(item.snippet || ""), 640),
      pdfUrl,
      sourceUrl: item.link || pdfUrl,
      source: "Google Scholar",
      reference: "",
      score: 0,
    };
    paper.reference = formatApa(paper);
    return paper;
  });
}

export async function searchUniversitySites(query: string): Promise<Paper[]> {
  const apiKey = readEnv("SERPAPI_API_KEY") || readEnv("SERP_API_KEY");
  if (!apiKey) return [];

  const universityQuery = `${query} (site:.edu OR site:.ac.uk OR site:edu.cn) (pdf OR "research paper" OR publication)`;
  const params = new URLSearchParams({
    engine: "google",
    q: universityQuery,
    num: "8",
    api_key: apiKey,
  });
  const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { organic_results?: GoogleSearchResult[] };

  return (payload.organic_results || [])
    .filter((item) => item.link && looksLikeAcademicUrl(item.link))
    .map((item) => {
      const paper: Paper = {
        id: item.link || item.title || crypto.randomUUID(),
        title: cleanText(item.title || "Untitled university site result"),
        authors: ["Unknown author"],
        year: extractYear(`${item.title || ""} ${item.snippet || ""}`),
        venue: universityVenue(item.link, item.displayed_link),
        abstract: truncate(cleanText(item.snippet || ""), 640),
        pdfUrl: looksLikePdfUrl(item.link) ? item.link : undefined,
        sourceUrl: item.link,
        source: "University Sites",
        reference: "",
        score: 0,
      };
      paper.reference = formatApa(paper);
      return paper;
    });
}

export function hasGoogleScholarProvider() {
  return Boolean(readEnv("SERPAPI_API_KEY") || readEnv("SERP_API_KEY"));
}

function scholarPdfUrl(resources?: GoogleScholarResult["resources"]) {
  return resources?.find((resource) => {
    const label = `${resource.title || ""} ${resource.file_format || ""}`.toLowerCase();
    return Boolean(resource.link && label.includes("pdf"));
  })?.link;
}

function extractScholarAuthors(summary?: string) {
  const authorBlock = summary?.split(" - ")[0] || "";
  return authorBlock
    .split(/,\s*| and /)
    .map((author) => author.replace(/\u2026|\.{3}/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function scholarVenue(summary?: string) {
  const parts = (summary || "").split(" - ").map(cleanText).filter(Boolean);
  return parts.length > 1 ? parts[1].replace(/\b(19|20)\d{2}\b/g, "").replace(/,+/g, ",").trim() : undefined;
}

function looksLikeAcademicUrl(value?: string) {
  if (!value) return false;
  return /\.edu\b|\.edu\/|\.ac\.uk\b|\.ac\.uk\/|edu\.cn\b|edu\.cn\//i.test(value);
}

function looksLikePdfUrl(value?: string) {
  if (!value) return false;
  return /\.pdf($|[?#])/i.test(value);
}

function universityVenue(link?: string, displayedLink?: string) {
  const value = link || displayedLink;
  if (!value) return undefined;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return displayedLink?.replace(/^www\./, "");
  }
}
