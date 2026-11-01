import { Link } from "react-router-dom";

// ui-spec.md §4 — a card is always a real <a> when it has a destination
// (never a <div onClick>), so it's reachable and operable by keyboard. A
// genuine zero still renders "0", never a blank card.
export default function MetricCard({ label, value, to }: { label: string; value: number; to?: string }) {
  const content = (
    <>
      <div className="small text-muted mb-1">{label}</div>
      <div className="h3 mb-0" style={{ color: "#006B3C" }}>
        {value}
      </div>
    </>
  );

  if (!to) {
    return <div className="card border-0 shadow-sm p-3 text-center h-100">{content}</div>;
  }

  return (
    <Link
      to={to}
      className="card border-0 shadow-sm p-3 text-center text-decoration-none text-dark h-100"
      aria-label={`${label}: ${value} — open the list`}
    >
      {content}
    </Link>
  );
}
