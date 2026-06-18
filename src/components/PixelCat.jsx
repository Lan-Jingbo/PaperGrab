export function PixelCat({ className = "", working = false }) {
  return (
    <svg
      className={`pixel-cat ${working ? "working" : ""} ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="12" y="20" width="40" height="34" fill="#ffffff" />
      <rect x="12" y="14" width="8" height="14" fill="#5c432d" />
      <rect x="44" y="14" width="8" height="14" fill="#5c432d" />
      <rect x="20" y="18" width="24" height="8" fill="#6d5134" />
      <rect x="12" y="28" width="12" height="14" fill="#765a3a" />
      <rect x="40" y="28" width="12" height="14" fill="#765a3a" />
      <rect x="26" y="20" width="4" height="16" fill="#4b3828" />
      <rect x="34" y="20" width="4" height="16" fill="#4b3828" />
      <rect x="30" y="24" width="4" height="12" fill="#ffffff" />
      <rect x="20" y="36" width="10" height="10" fill="#d6c46d" />
      <rect x="34" y="36" width="10" height="10" fill="#d6c46d" />
      <rect x="24" y="38" width="4" height="6" fill="#1f2328" />
      <rect x="36" y="38" width="4" height="6" fill="#1f2328" />
      <rect x="28" y="46" width="8" height="4" fill="#6b4a32" />
      <rect x="30" y="50" width="4" height="4" fill="#1f2328" />
      <rect className="pixel-cat-paw left" x="18" y="52" width="12" height="6" fill="#f6f1e8" />
      <rect className="pixel-cat-paw right" x="34" y="52" width="12" height="6" fill="#f6f1e8" />
      <rect className="pixel-paper" x="18" y="56" width="28" height="6" fill="#276066" />
    </svg>
  );
}
