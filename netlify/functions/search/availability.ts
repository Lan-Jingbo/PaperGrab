import { fetchWithTimeout } from "./http";
import type { AvailabilityResult, Paper, UrlCheck } from "./types";

export async function filterReachablePdfPapers(papers: Paper[]): Promise<AvailabilityResult> {
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
