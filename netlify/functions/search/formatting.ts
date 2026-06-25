import { STOP_WORDS } from "./constants";
import type { Paper } from "./types";

export function extractYear(value: string) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

export function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(String(item))).filter(Boolean);
}

export function uniqueTerms(value: string) {
  return [...new Set(extractTerms(value))];
}

export function extractTerms(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word));
}

export function countMatches(value: string, terms: string[]) {
  const haystack = value.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase())).length;
}

export function cleanAuthors(authors: string[]) {
  const cleaned = authors.map(cleanText).filter(Boolean);
  return cleaned.length > 0 ? cleaned.slice(0, 8) : ["Unknown author"];
}

export function formatApa(paper: Paper) {
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

export function invertedAbstract(index?: Record<string, number[]>) {
  if (!index) return "";
  const words: Array<[string, number]> = [];
  Object.entries(index).forEach(([word, positions]) => positions.forEach((position) => words.push([word, position])));
  return words
    .sort((a, b) => a[1] - b[1])
    .map(([word]) => word)
    .join(" ");
}

export function arxivPdfFromId(id?: string) {
  return id ? `https://arxiv.org/pdf/${id}` : undefined;
}

export function doiUrl(doi?: string) {
  return doi ? `https://doi.org/${doi}` : undefined;
}

export function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

export function truncate(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}
