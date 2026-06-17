import React from "react";
import { searchPapers } from "./api/papers.js";
import { starterPrompts } from "./constants.js";
import { Notice } from "./components/Notice.jsx";
import { SearchComposer } from "./components/SearchComposer.jsx";
import { PaperResults } from "./components/PaperResults.jsx";
import { ResearchPlan } from "./components/ResearchPlan.jsx";
import { ReferenceList } from "./components/ReferenceList.jsx";

function App() {
  const [query, setQuery] = React.useState(starterPrompts[0]);
  const [papers, setPapers] = React.useState([]);
  const [plan, setPlan] = React.useState(null);
  const [actions, setActions] = React.useState([]);
  const [researchAdvice, setResearchAdvice] = React.useState(null);
  const [summary, setSummary] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSearch(event) {
    event?.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError("");

    try {
      const payload = await searchPapers(cleanQuery);
      setPapers(payload.papers || []);
      setPlan(payload.plan || null);
      setActions(payload.actions || []);
      setResearchAdvice(payload.researchAdvice || null);
      setSummary(payload.summary || "");
    } catch (err) {
      setError(err.message);
      setPapers([]);
      setPlan(null);
      setActions([]);
      setResearchAdvice(null);
      setSummary("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-label="PaperGrab intro">
        <div className="brand-row">
          <span className="brand-mark">
            <img src="/papergrab-logo.svg" alt="" />
          </span>
          <span>PaperGrab</span>
        </div>
        <h1>Tell me your research topic. I will find papers first.</h1>
        <p>Browse open paper sources, return PDF links, suggest a research direction, and format references.</p>
      </section>

      <SearchComposer query={query} setQuery={setQuery} loading={loading} onSubmit={handleSearch} />

      <section className="prompt-strip" aria-label="Example prompts">
        {starterPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setQuery(prompt)}>
            {prompt}
          </button>
        ))}
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {summary && <Notice>{summary}</Notice>}

      <PaperResults papers={papers} />
      <ResearchPlan plan={plan} actions={actions} advice={researchAdvice} />
      <ReferenceList papers={papers} />
    </main>
  );
}

export default App;
