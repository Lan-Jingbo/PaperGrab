import React from "react";
import { Clipboard } from "lucide-react";

export function ReferenceList({ papers }) {
  const [copied, setCopied] = React.useState(false);
  const references = papers.map((paper) => paper.reference).join("\n\n");

  async function copyReferences() {
    if (!references) return;
    await navigator.clipboard.writeText(references);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!papers.length) return null;

  return (
    <section className="section-block" aria-label="Reference list">
      <div className="section-heading">
        <span>3</span>
        <div>
          <h2>Reference list</h2>
          <p>APA-style references generated from returned metadata.</p>
        </div>
      </div>
      <button className="ghost-button" type="button" onClick={copyReferences}>
        <Clipboard size={17} aria-hidden="true" />
        <span>{copied ? "Copied" : "Copy all"}</span>
      </button>
      <pre className="reference-box">{references}</pre>
    </section>
  );
}
