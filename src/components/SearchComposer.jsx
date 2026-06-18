import { Loader2, Search } from "lucide-react";
import { PixelCat } from "./PixelCat.jsx";

export function SearchComposer({ query, setQuery, loading, onSubmit }) {
  const showPlaceholder = !query.trim();

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!loading && query.trim()) onSubmit(event);
  }

  return (
    <form className={`composer ${loading ? "is-loading" : ""}`} onSubmit={onSubmit}>
      <div className="composer-input">
        <PixelCat className="composer-cat" />
        {showPlaceholder && (
          <div className="typing-placeholder" aria-hidden="true">
            <span>Let me know what you are finding,</span>
          </div>
        )}
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Research topic"
          rows={4}
        />
      </div>
      <div className="composer-footer">
        {loading && (
          <div className="working-indicator" role="status" aria-live="polite">
            <PixelCat working />
            <span>Tabby is browsing papers</span>
          </div>
        )}
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          <span>{loading ? "Browsing" : "Browse papers"}</span>
        </button>
      </div>
    </form>
  );
}
