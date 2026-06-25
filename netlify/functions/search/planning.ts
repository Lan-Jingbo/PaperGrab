import OpenAI from "openai";

import { GENERIC_DOMAIN_WORDS, METHOD_WORDS } from "./constants";
import { cleanText, extractTerms, normalizeList, uniqueTerms } from "./formatting";
import { readEnv } from "./http";
import type { ResearchPlan } from "./types";

export async function buildResearchPlan(query: string): Promise<ResearchPlan> {
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
