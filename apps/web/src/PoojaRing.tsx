const RADIUS = 120;
const CIRCLE = 2 * Math.PI * RADIUS;

// How full the ring is: Students Present so far out of the Active Students today.
export function PoojaRing({ present, active }: { present: number | null; active: number | null }) {
  const filled = active ? (Math.min(present ?? 0, active) / active) * CIRCLE : 0;
  return (
    <svg className="ring" viewBox="0 0 300 300" role="img" aria-label="Students Present so far">
      <circle className="ring-track" cx="150" cy="150" r={RADIUS} />
      <circle
        className="ring-done"
        cx="150"
        cy="150"
        r={RADIUS}
        strokeDasharray={`${String(filled)} ${String(CIRCLE)}`}
        transform="rotate(-90 150 150)"
      />
      <text className="ring-number" x="150" y="150" textAnchor="middle">
        {present ?? '–'}
      </text>
      <text className="ring-caption" x="150" y="180" textAnchor="middle">
        Students Present so far
      </text>
      {active !== null && (
        <text className="ring-caption" x="150" y="202" textAnchor="middle">
          out of {active} Active Students
        </text>
      )}
    </svg>
  );
}
