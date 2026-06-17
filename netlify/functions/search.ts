import type { Config, Context } from "@netlify/functions";
import { XMLParser } from "fast-xml-parser";
import OpenAI from "openai";

declare const Netlify:
  | {
      env: {
        get(key: string): string | undefined;
      };
    }
  | undefined;

type Source = "Semantic Scholar" | "arXiv" | "OpenAlex" | "Crossref";

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
  source: Source;
  reference: string;
  score: number;
};

type ResearchPlan = {
  intent: string;
  concepts: string[];
  queries: string[];
  planSource: "ai" | "fallback";
};

type BrowseAction = {
  manual: string;
  target: Source | "Planner" | "Ranker";
  query?: string;
  status: "done" | "skipped" | "failed";
  found: number;
  note: string;
};

type ResearchAdvice = {
  hypotheses: string[];
  studyDesign: string[];
  experimentSteps: string[];
  variables: string[];
  cautions: string[];
};

type UrlCheck = {
  status: "ok" | "unreachable" | "unknown";
  reason: string;
};

type AvailabilityResult = {
  papers: Paper[];
  checked: number;
  skipped: number;
  unknown: number;
  blockedUrls: Set<string>;
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
};

type OpenAlexWork = {
  id?: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  primary_location?: {
    landing_page_url?: string;
    pdf_url?: string;
    source?: { display_name?: string };
  };
  best_oa_location?: {
    landing_page_url?: string;
    pdf_url?: string;
  };
  authorships?: Array<{ author?: { display_name?: string } }>;
  abstract_inverted_index?: Record<string, number[]>;
};

type CrossrefWork = {
  DOI?: string;
  URL?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  published?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  link?: Array<{ URL?: string; "content-type"?: string }>;
  abstract?: string;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const SOURCE_MANUALS = {
  semantic:
    "Semantic Scholar action manual: call Graph API with title/authors/year/abstract/openAccessPdf only; never fetch result pages unless metadata is missing.",
  arxiv:
    "arXiv action manual: call Atom API with compact all:term queries; use returned pdf link and abstract summary; retry shorter high-signal queries.",
  openalex:
    "OpenAlex action manual: search OA works with is_oa=true; read primary_location and best_oa_location for PDF/landing URLs.",
  crossref:
    "Crossref action manual: query works metadata for DOI/reference details; use PDF links only when the metadata exposes them directly.",
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

  const actions: BrowseAction[] = [];
  const plan = await buildResearchPlan(query);
  actions.push({
    manual: "ActionBook-style planning manual",
    target: "Planner",
    status: "done",
    found: plan.queries.length,
    note:
      plan.planSource === "ai"
        ? "AI planner converted the request into targeted scholarly search actions."
        : "Fallback planner extracted compact search terms because AI Gateway/OpenAI env was unavailable.",
  });

  const results = await Promise.allSettled(plan.queries.flatMap((plannedQuery) => browsePaperSources(plannedQuery)));
  const papers = results.flatMap((result) => {
    if (result.status === "rejected") return [];
    actions.push(...result.value.actions);
    return result.value.papers;
  });

  const rankedAll = rankAndDedupe(papers, plan.concepts);
  const pdfCandidates = rankedAll.filter((paper) => paper.pdfUrl).slice(0, 14);
  const availability = await filterReachablePdfPapers(pdfCandidates);
  const fallback =
    availability.papers.length > 0
      ? availability.papers.slice(0, 10)
      : rankedAll
          .filter((paper) => !paper.pdfUrl || !availability.blockedUrls.has(paper.pdfUrl))
          .slice(0, 10);
  const pdfCount = fallback.filter((paper) => paper.pdfUrl).length;

  actions.push({
    manual:
      "Availability manual: before spending tokens on PDF/source content, make a bounded HEAD or partial GET request and skip clear Cloudflare 523 origin-unreachable links.",
    target: "Ranker",
    status: "done",
    found: fallback.length,
    note: `Checked ${availability.checked} candidate PDF URLs; skipped ${availability.skipped} origin-unreachable links and kept ${availability.unknown} uncertain links.`,
  });

  actions.push({
    manual: "Ranking manual",
    target: "Ranker",
    status: "done",
    found: fallback.length,
    note: "Merged duplicate papers, preferred reachable open PDFs, then ranked title and abstract matches.",
  });

  const researchAdvice = await buildResearchAdvice(query, plan, fallback);

  return json({
    query,
    plan,
    actions,
    researchAdvice,
    summary:
      fallback.length > 0
        ? `Browsed ${plan.queries.length} targeted queries across paper sources and found ${fallback.length} papers. ${pdfCount} include direct PDF links.${availability.skipped > 0 ? ` Skipped ${availability.skipped} PDF links with origin-unreachable signals.` : ""}`
        : "No papers were found. Try a more specific method, domain, or phrase.",
    papers: fallback.map(({ score, ...paper }) => paper),
  });
};

export const config: Config = {
  path: "/api/search",
};

async function buildResearchPlan(query: string): Promise<ResearchPlan> {
  const fallback = fallbackPlan(query);
  const hasGateway = Boolean(readEnv("OPENAI_BASE_URL") || readEnv("OPENAI_API_KEY"));
  if (!hasGateway) return fallback;

  try {
    const openai = new OpenAI({
      apiKey: readEnv("OPENAI_API_KEY") || "netlify-ai-gateway",
      baseURL: readEnv("OPENAI_BASE_URL"),
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You plan token-efficient academic paper browsing. Return JSON only with intent, concepts, and queries. Use concise search phrases for scholarly APIs, not prose.",
        },
        {
          role: "user",
          content: `Researcher request: ${query}\nReturn {"intent": string, "concepts": string[], "queries": string[]} with 3-5 targeted queries.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as Partial<ResearchPlan>;
    const queries = normalizeList(parsed.queries).slice(0, 5);
    const concepts = uniqueTerms(`${normalizeList(parsed.concepts).join(" ")} ${query}`).slice(0, 12);
    if (queries.length === 0 || concepts.length === 0) return fallback;

    return {
      intent: cleanText(parsed.intent || query),
      concepts,
      queries,
      planSource: "ai",
    };
  } catch (error) {
    console.error("AI planner failed", error);
    return fallback;
  }
}

function fallbackPlan(query: string): ResearchPlan {
  const concepts = extractTerms(query).slice(0, 12);
  const core = concepts.slice(0, 7).join(" ");
  const methodTerms = concepts.filter((term) => METHOD_WORDS.has(term));
  const domainTerms = concepts.filter((term) => !METHOD_WORDS.has(term) && !GENERIC_DOMAIN_WORDS.has(term));
  const queries = [
    core,
    [...methodTerms, ...domainTerms.slice(0, 5)].join(" "),
    domainTerms.slice(0, 7).join(" "),
    concepts.slice(0, 4).join(" "),
  ].filter(Boolean);

  return {
    intent: query,
    concepts,
    queries: [...new Set(queries)].slice(0, 4),
    planSource: "fallback",
  };
}

async function buildResearchAdvice(query: string, plan: ResearchPlan, papers: Paper[]): Promise<ResearchAdvice> {
  const fallback = fallbackAdvice(query, plan, papers);
  const hasGateway = Boolean(readEnv("OPENAI_BASE_URL") || readEnv("OPENAI_API_KEY"));
  if (!hasGateway) return fallback;

  try {
    const openai = new OpenAI({
      apiKey: readEnv("OPENAI_API_KEY") || "netlify-ai-gateway",
      baseURL: readEnv("OPENAI_BASE_URL"),
    });
    const paperTitles = papers.slice(0, 6).map((paper) => paper.title);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a concise academic research design assistant. Return JSON only. Give practical advice that can fit social science studies, computational studies, or lab experiments depending on the topic.",
        },
        {
          role: "user",
          content:
            `Research request: ${query}\n` +
            `Search intent: ${plan.intent}\n` +
            `Top paper titles: ${paperTitles.join(" | ")}\n` +
            'Return {"hypotheses": string[], "studyDesign": string[], "experimentSteps": string[], "variables": string[], "cautions": string[]} with 2-4 short items per field.',
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as Partial<ResearchAdvice>;
    const advice = normalizeAdvice(parsed);
    return hasUsefulAdvice(advice) ? advice : fallback;
  } catch (error) {
    console.error("Research advice failed", error);
    return fallback;
  }
}

function fallbackAdvice(query: string, plan: ResearchPlan, papers: Paper[]): ResearchAdvice {
  const topic = plan.intent || query;
  const strongestPaper = papers[0]?.title;

  return {
    hypotheses: [
      `Frame one testable claim around whether the target method improves outcomes for: ${topic}.`,
      "Compare the proposed method against a clear baseline from the returned papers.",
      strongestPaper ? `Use "${strongestPaper}" as an anchor paper for the first hypothesis.` : "Use the top returned paper as the anchor for the first hypothesis.",
    ],
    studyDesign: [
      "For computational work, use a held-out validation set and at least one baseline model.",
      "For social science work, define population, sampling frame, treatment or exposure, and outcome before data collection.",
      "For lab or field experiments, separate exploratory pilot work from confirmatory testing.",
    ],
    experimentSteps: [
      "Turn the research request into 2-3 measurable research questions.",
      "Extract methods, datasets, measures, and limitations from the PDF papers.",
      "Run a baseline condition, then test the proposed intervention or model under the same evaluation metric.",
      "Report effect size, uncertainty, failure cases, and replication details.",
    ],
    variables: [
      "Independent variable: method, intervention, exposure, or model choice.",
      "Dependent variable: performance, behavior, outcome, accuracy, or measured effect.",
      "Controls: dataset quality, sample selection, confounders, time period, and measurement protocol.",
    ],
    cautions: [
      "Do not treat paper availability as evidence quality; inspect methods and limitations.",
      "Avoid overclaiming causality unless the design supports causal inference.",
      "Predefine exclusion rules and evaluation metrics before final testing.",
    ],
  };
}

function normalizeAdvice(value: Partial<ResearchAdvice>): ResearchAdvice {
  return {
    hypotheses: normalizeList(value.hypotheses).slice(0, 4),
    studyDesign: normalizeList(value.studyDesign).slice(0, 4),
    experimentSteps: normalizeList(value.experimentSteps).slice(0, 4),
    variables: normalizeList(value.variables).slice(0, 4),
    cautions: normalizeList(value.cautions).slice(0, 4),
  };
}

function hasUsefulAdvice(advice: ResearchAdvice) {
  return Object.values(advice).some((items) => items.length > 0);
}

async function browsePaperSources(query: string): Promise<{ actions: BrowseAction[]; papers: Paper[] }> {
  const searches: Array<[Source, string, (query: string) => Promise<Paper[]>]> = [
    ["Semantic Scholar", SOURCE_MANUALS.semantic, searchSemanticScholar],
    ["arXiv", SOURCE_MANUALS.arxiv, searchArxiv],
    ["OpenAlex", SOURCE_MANUALS.openalex, searchOpenAlex],
    ["Crossref", SOURCE_MANUALS.crossref, searchCrossref],
  ];

  const settled = await Promise.allSettled(
    searches.map(async ([source, manual, search]) => {
      const papers = await search(query);
      return {
        papers,
        action: {
          manual,
          target: source,
          query,
          status: "done" as const,
          found: papers.length,
          note: `Browsed ${source} through a compact metadata endpoint.`,
        },
      };
    }),
  );

  const actions: BrowseAction[] = [];
  const papers: Paper[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      papers.push(...result.value.papers);
      actions.push(result.value.action);
      return;
    }
    actions.push({
      manual: searches[index][1],
      target: searches[index][0],
      query,
      status: "failed",
      found: 0,
      note: "Source request failed; continued with other paper sources.",
    });
  });

  return { actions, papers };
}

async function searchSemanticScholar(query: string): Promise<Paper[]> {
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

async function searchArxiv(query: string): Promise<Paper[]> {
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

async function searchOpenAlex(query: string): Promise<Paper[]> {
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

async function searchCrossref(query: string): Promise<Paper[]> {
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

function rankAndDedupe(papers: Paper[], concepts: string[]) {
  const seen = new Set<string>();
  const unique: Paper[] = [];

  for (const paper of papers) {
    const key = (paper.doi || paper.title).toLowerCase().replace(/\W+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    paper.score = scorePaper(paper, concepts);
    unique.push(paper);
  }

  const domainTerms = concepts.filter((term) => !METHOD_WORDS.has(term) && !GENERIC_DOMAIN_WORDS.has(term));
  const minimumDomainMatches = Math.min(2, domainTerms.length);
  const relevant =
    minimumDomainMatches > 0
      ? unique.filter((paper) => countMatches(`${paper.title} ${paper.abstract || ""}`, domainTerms) >= minimumDomainMatches)
      : unique;

  return (relevant.length > 0 ? relevant : unique).sort((a, b) => b.score - a.score);
}

function scorePaper(paper: Paper, concepts: string[]) {
  const title = paper.title.toLowerCase();
  const abstract = (paper.abstract || "").toLowerCase();
  const venue = (paper.venue || "").toLowerCase();
  const haystack = `${title} ${abstract} ${venue}`;
  const matchScore = concepts.reduce((score, concept) => {
    const term = concept.toLowerCase();
    if (title.includes(term)) return score + 8;
    if (abstract.includes(term)) return score + 3;
    if (venue.includes(term)) return score + 2;
    return score;
  }, 0);
  const domainTerms = concepts.filter((term) => !METHOD_WORDS.has(term) && !GENERIC_DOMAIN_WORDS.has(term));
  const domainTitleScore = domainTerms.filter((term) => title.includes(term)).length * 6;
  const domainCoverageScore = domainTerms.length > 0 && domainTerms.every((term) => haystack.includes(term)) ? 14 : 0;
  const pdfScore = paper.pdfUrl ? 20 : 0;
  const recencyScore = paper.year ? Math.max(0, Math.min(8, paper.year - 2018)) : 0;
  return matchScore + domainTitleScore + domainCoverageScore + pdfScore + recencyScore;
}

async function filterReachablePdfPapers(papers: Paper[]): Promise<AvailabilityResult> {
  if (papers.length === 0) {
    return { papers, checked: 0, skipped: 0, unknown: 0, blockedUrls: new Set() };
  }

  const checks = await Promise.allSettled(
    papers.map(async (paper) => ({
      paper,
      check: await checkUrlAvailability(paper.pdfUrl),
    })),
  );

  const kept: Paper[] = [];
  const blockedUrls = new Set<string>();
  let skipped = 0;
  let unknown = 0;

  checks.forEach((result) => {
    if (result.status === "rejected") {
      unknown += 1;
      return;
    }

    const { paper, check } = result.value;
    if (check.status === "unreachable" && paper.pdfUrl) {
      skipped += 1;
      blockedUrls.add(paper.pdfUrl);
      return;
    }

    if (check.status === "unknown") unknown += 1;
    kept.push(paper);
  });

  return {
    papers: kept,
    checked: papers.length,
    skipped,
    unknown,
    blockedUrls,
  };
}

async function checkUrlAvailability(url?: string): Promise<UrlCheck> {
  if (!url) return { status: "unknown", reason: "No URL" };

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "HEAD",
        headers: { Accept: "application/pdf,text/html;q=0.8,*/*;q=0.5" },
      },
      4500,
    );

    if (isOriginUnreachableStatus(response.status)) {
      return { status: "unreachable", reason: `HTTP ${response.status}` };
    }

    if (response.ok) {
      return { status: "ok", reason: `HTTP ${response.status}` };
    }

    if (shouldRetryWithPartialGet(response.status)) {
      return checkUrlWithPartialGet(url);
    }

    return { status: "unknown", reason: `HTTP ${response.status}` };
  } catch {
    return { status: "unknown", reason: "HEAD request failed" };
  }
}

async function checkUrlWithPartialGet(url: string): Promise<UrlCheck> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/pdf,text/html;q=0.8,*/*;q=0.5",
          Range: "bytes=0-2047",
        },
      },
      5500,
    );

    if (isOriginUnreachableStatus(response.status)) {
      return { status: "unreachable", reason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") || contentType.includes("text/plain")) {
      const preview = await response.text();
      if (hasOriginUnreachableSignal(preview)) {
        return { status: "unreachable", reason: "Origin-unreachable page body" };
      }
    }

    if (response.ok) {
      return { status: "ok", reason: `HTTP ${response.status}` };
    }

    return { status: "unknown", reason: `HTTP ${response.status}` };
  } catch {
    return { status: "unknown", reason: "Partial GET failed" };
  }
}

function isOriginUnreachableStatus(status: number) {
  return status === 523;
}

function shouldRetryWithPartialGet(status: number) {
  return status === 401 || status === 403 || status === 405 || status === 406 || status === 501;
}

function hasOriginUnreachableSignal(value: string) {
  return /error code\s*523|origin is unreachable/i.test(value);
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(String(item))).filter(Boolean);
}

function uniqueTerms(value: string) {
  return [...new Set(extractTerms(value))];
}

function extractTerms(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word));
}

function countMatches(value: string, terms: string[]) {
  const haystack = value.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase())).length;
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

function invertedAbstract(index?: Record<string, number[]>) {
  if (!index) return "";
  const words: Array<[string, number]> = [];
  Object.entries(index).forEach(([word, positions]) => positions.forEach((position) => words.push([word, position])));
  return words
    .sort((a, b) => a[1] - b[1])
    .map(([word]) => word)
    .join(" ");
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

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function truncate(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}

function readEnv(key: string) {
  return typeof Netlify !== "undefined" ? Netlify?.env.get(key) : undefined;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

const METHOD_WORDS = new Set([
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

const GENERIC_DOMAIN_WORDS = new Set(["system", "systems"]);

const STOP_WORDS = new Set([
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
