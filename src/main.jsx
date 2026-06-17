import React from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Clipboard, Download, ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import "./styles.css";

const starterPrompts = [
  "Machine learning techniques for binary star systems in astrophysics",
  "Recent open-access papers about retrieval augmented generation evaluation",
  "CRISPR delivery methods for rare genetic disease therapy",
];

function App() {
  const [query, setQuery] = React.useState(starterPrompts[0]);
  const [papers, setPapers] = React.useState([]);
  const [summary, setSummary] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  async function searchPapers(event) {
    event?.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanQuery }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Paper search failed.");
      }

      setPapers(payload.papers || []);
      setSummary(payload.summary || "");
    } catch (err) {
      setError(err.message);
      setPapers([]);
      setSummary("");
    } finally {
      setLoading(false);
    }
  }

  const references = papers.map((paper) => paper.reference).join("\n\n");

  async function copyReferences() {
    if (!references) return;
    await navigator.clipboard.writeText(references);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="shell">
      <section className="workspace" aria-label="Paper search workspace">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <BookOpen size={24} aria-hidden="true" />
            </div>
            <div>
              <h1>PaperGrab</h1>
              <p>Open PDFs and clean references for research starts.</p>
            </div>
          </div>

          <div className="prompt-list" aria-label="Example prompts">
            {starterPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => setQuery(prompt)}>
                <Sparkles size={16} aria-hidden="true" />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat">
          <div className="chat-header">
            <div>
              <span className="eyebrow">Academic reference assistant</span>
              <h2>Tell me what paper references you need.</h2>
            </div>
            <div className="status-pill">PDF-first search</div>
          </div>

          <form className="composer" onSubmit={searchPapers}>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Describe your research topic, method, field, or paper angle..."
              rows={4}
            />
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
              <span>{loading ? "Searching" : "Grab papers"}</span>
            </button>
          </form>

          {error && <div className="notice error">{error}</div>}
          {summary && <div className="notice">{summary}</div>}

          <div className="results">
            {papers.map((paper) => (
              <article className="paper-card" key={paper.id}>
                <div className="paper-meta">
                  <span>{paper.source}</span>
                  <span>{paper.year || "Year unknown"}</span>
                </div>
                <h3>{paper.title}</h3>
                <p className="authors">{paper.authors.join(", ")}</p>
                {paper.abstract && <p className="abstract">{paper.abstract}</p>}
                <div className="actions">
                  {paper.pdfUrl && (
                    <a className="primary-link" href={paper.pdfUrl} target="_blank" rel="noreferrer">
                      <Download size={17} aria-hidden="true" />
                      <span>PDF</span>
                    </a>
                  )}
                  {paper.sourceUrl && (
                    <a href={paper.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={17} aria-hidden="true" />
                      <span>Source</span>
                    </a>
                  )}
                </div>
                <pre>{paper.reference}</pre>
              </article>
            ))}
          </div>

          {papers.length > 0 && (
            <section className="reference-panel" aria-label="Reference list">
              <div>
                <h2>Reference List</h2>
                <p>APA-style references generated from returned metadata.</p>
              </div>
              <button type="button" onClick={copyReferences}>
                <Clipboard size={17} aria-hidden="true" />
                <span>{copied ? "Copied" : "Copy all"}</span>
              </button>
              <pre>{references}</pre>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;

createRoot(document.getElementById("root")).render(<App />);
