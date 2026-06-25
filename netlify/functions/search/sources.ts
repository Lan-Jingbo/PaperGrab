import { SOURCE_MANUALS } from "./constants";
import { hasGoogleScholarProvider, searchArxiv, searchCrossref, searchGoogleScholar, searchOpenAlex, searchSemanticScholar, searchUniversitySites } from "./source-searches";
import type { BrowseAction, Paper, SourceSearch } from "./types";

export async function browsePaperSources(query: string): Promise<{ actions: BrowseAction[]; papers: Paper[] }> {
  const searches: SourceSearch[] = [
    { source: "Semantic Scholar", manual: SOURCE_MANUALS.semantic, search: searchSemanticScholar },
    { source: "arXiv", manual: SOURCE_MANUALS.arxiv, search: searchArxiv },
    { source: "OpenAlex", manual: SOURCE_MANUALS.openalex, search: searchOpenAlex },
    { source: "Crossref", manual: SOURCE_MANUALS.crossref, search: searchCrossref },
    {
      source: "Google Scholar",
      manual: SOURCE_MANUALS.scholar,
      search: searchGoogleScholar,
      enabled: hasGoogleScholarProvider,
      skippedNote: "Google Scholar skipped because SERPAPI_API_KEY is not configured; avoided direct Scholar scraping to save tokens.",
    },
    {
      source: "University Sites",
      manual: SOURCE_MANUALS.university,
      search: searchUniversitySites,
      enabled: hasGoogleScholarProvider,
      skippedNote: "University Sites skipped because SERPAPI_API_KEY is not configured; avoided direct university-site crawling.",
    },
  ];

  const settled = await Promise.allSettled(
    searches.map(async ({ source, manual, search, enabled, skippedNote }) => {
      if (enabled && !enabled()) {
        return {
          papers: [],
          action: {
            manual,
            target: source,
            query,
            status: "skipped" as const,
            found: 0,
            note: skippedNote || "Source skipped because required configuration is unavailable.",
          },
        };
      }

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
      manual: searches[index].manual,
      target: searches[index].source,
      query,
      status: "failed",
      found: 0,
      note: "Source request failed; continued with other paper sources.",
    });
  });

  return { actions, papers };
}
