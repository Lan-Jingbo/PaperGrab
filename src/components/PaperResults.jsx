import { Download, ExternalLink } from "lucide-react";

export function PaperResults({ papers }) {
  if (!papers.length) return null;

  return (
    <section className="section-block" aria-label="PDF papers">
      <div className="section-heading">
        <span>1</span>
        <div>
          <h2>PDF papers</h2>
          <p>Open the PDF first, then inspect the source page if needed.</p>
        </div>
      </div>

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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
