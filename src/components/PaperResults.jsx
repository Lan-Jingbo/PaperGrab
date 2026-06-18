import React from "react";
import { Clipboard, Download, ExternalLink } from "lucide-react";

export function PaperResults({ papers }) {
  const [copiedId, setCopiedId] = React.useState("");

  async function copyReference(paper) {
    if (!paper.reference) return;
    await navigator.clipboard.writeText(paper.reference);
    setCopiedId(paper.id);
    window.setTimeout(() => setCopiedId(""), 1600);
  }

  if (!papers.length) return null;

  return (
    <details className="section-block collapsible-section" aria-label="PDF papers" open>
      <summary className="section-summary">
        <div className="section-heading">
          <span>1</span>
          <div>
            <h2>PDF papers</h2>
            <p>Open the PDF first, then inspect the source page if needed.</p>
          </div>
        </div>
      </summary>

      <div className="paper-list">
        {papers.map((paper) => (
          <article className="paper-card" key={paper.id}>
            <div className="paper-topline">
              <span>{paper.source}</span>
              <span>{paper.year || "Year unknown"}</span>
            </div>
            <h3>{paper.title}</h3>
            <p className="authors">{paper.authors.join(", ")}</p>
            {paper.abstract && <p className="abstract">{paper.abstract}</p>}
            <div className="paper-actions">
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
              {paper.reference && (
                <button className="ghost-button" type="button" onClick={() => copyReference(paper)}>
                  <Clipboard size={17} aria-hidden="true" />
                  <span>{copiedId === paper.id ? "Copied" : "Copy reference"}</span>
                </button>
              )}
            </div>
            {paper.reference && <pre className="paper-reference">{paper.reference}</pre>}
          </article>
        ))}
      </div>
    </details>
  );
}
