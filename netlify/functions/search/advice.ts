import OpenAI from "openai";

import { cleanText, normalizeList } from "./formatting";
import { readEnv } from "./http";
import type { Paper, ResearchAdvice, ResearchPlan } from "./types";

export async function buildResearchAdvice(query: string, plan: ResearchPlan, papers: Paper[]): Promise<ResearchAdvice> {
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
