export async function searchPapers(query) {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Paper search failed.");
  }

  return payload;
}
