import { GENERIC_DOMAIN_WORDS, METHOD_WORDS } from "./constants";
import { countMatches } from "./formatting";
import type { Paper } from "./types";

export function rankAndDedupe(papers: Paper[], concepts: string[]) {
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
