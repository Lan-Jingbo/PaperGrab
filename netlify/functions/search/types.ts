export type Source = "Semantic Scholar" | "arXiv" | "OpenAlex" | "Crossref" | "Google Scholar" | "University Sites";

export type Paper = {
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

export type ResearchPlan = {
  intent: string;
  concepts: string[];
  queries: string[];
  planSource: "ai" | "fallback";
};

export type BrowseAction = {
  manual: string;
  target: Source | "Planner" | "Ranker";
  query?: string;
  status: "done" | "skipped" | "failed";
  found: number;
  note: string;
};

export type ResearchAdvice = {
  hypotheses: string[];
  studyDesign: string[];
  experimentSteps: string[];
  variables: string[];
  cautions: string[];
};

export type UrlCheck = {
  status: "ok" | "unreachable" | "unknown";
  reason: string;
};

export type AvailabilityResult = {
  papers: Paper[];
  checked: number;
  skipped: number;
  unknown: number;
  blockedUrls: Set<string>;
};

export type SemanticPaper = {
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

export type OpenAlexWork = {
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

export type CrossrefWork = {
  DOI?: string;
  URL?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  published?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  link?: Array<{ URL?: string; "content-type"?: string }>;
  abstract?: string;
};

export type GoogleScholarResult = {
  title?: string;
  link?: string;
  snippet?: string;
  publication_info?: {
    summary?: string;
    authors?: Array<{ name?: string }>;
  };
  resources?: Array<{
    title?: string;
    file_format?: string;
    link?: string;
  }>;
};

export type GoogleSearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
};

export type SourceSearch = {
  source: Source;
  manual: string;
  search: (query: string) => Promise<Paper[]>;
  enabled?: () => boolean;
  skippedNote?: string;
};
