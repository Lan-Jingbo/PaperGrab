import { Loader2, Search } from "lucide-react";

export function SearchComposer({ query, setQuery, loading, onSubmit }) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Example: I study binary star systems and want papers about applying machine learning to detection, classification, or orbital parameter estimation."
        rows={4}
      />
      <button type="submit" disabled={loading || !query.trim()}>
        {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        <span>{loading ? "Browsing" : "Browse papers"}</span>
      </button>
    </form>
  );
}
