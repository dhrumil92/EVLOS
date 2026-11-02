const RADIUS = 120;
const CIRCLE = 2 * Math.PI * RADIUS;
// Sets how full the ring is. Phase 4 replaces this with the real number of Active Students.
const EXPECTED_STUDENTS = 360;

export function PoojaRing({ present }: { present: number | null }) {
  const filled = (Math.min(present ?? 0, EXPECTED_STUDENTS) / EXPECTED_STUDENTS) * CIRCLE;
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
      <text className="ring-number" x="150" y="160" textAnchor="middle">
        {present ?? '–'}
      </text>
      <text className="ring-caption" x="150" y="190" textAnchor="middle">
        Students Present so far
      </text>
    </svg>
  );
}
