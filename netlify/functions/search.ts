import type { Config, Context } from "@netlify/functions";

import { buildResearchAdvice } from "./search/advice";
import { filterReachablePdfPapers } from "./search/availability";
import { json } from "./search/http";
import { buildResearchPlan } from "./search/planning";
import { rankAndDedupe } from "./search/ranking";
import { browsePaperSources } from "./search/sources";
import type { BrowseAction } from "./search/types";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Use POST with a JSON body containing a query." }, 405);
  }

  let query = "";
  try {
    const payload = await req.json();
    query = String(payload.query || "").trim();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  try {
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
    const rawPapers = results.flatMap((result) => {
      if (result.status === "rejected") return [];
      actions.push(...result.value.actions);
      return result.value.papers;
    });

    const rankedAll = rankAndDedupe(rawPapers, plan.concepts);
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
  } catch (error) {
    console.error("Search function failed", error);
    return json({ error: "Search failed. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/search",
};
