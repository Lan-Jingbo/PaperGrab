export function Notice({ children, tone = "default" }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
