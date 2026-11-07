import type { PoojaStatusName, Report } from './report-source.js';

// The bar colours are the ones the Reports page already uses for each Pooja Status.
const COUNTED: { status: PoojaStatusName; line: string }[] = [
  { status: 'Present', line: 'border-(--bar-present)' },
  { status: 'Not Applicable', line: 'border-(--bar-not-applicable)' },
  { status: 'Absent', line: 'border-(--bar-absent)' },
  { status: 'Needs Review', line: 'border-(--bar-review)' },
];

// How many Students had each Pooja Status on the Day a Day Report is about. Needs Review
// only appears when some Student has it, as on a Day not yet Finalized.
export function DayCounts({ report }: { report: Report }) {
  const countOf = (status: PoojaStatusName) =>
    report.rows.filter((row) => row.statuses[0] === status).length;
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {COUNTED.filter((one) => one.status !== 'Needs Review' || countOf(one.status) > 0).map(
        (one) => (
          <div key={one.status} className={`min-w-20 border-l-[3px] pl-3 ${one.line}`}>
            <dt className="text-sm text-muted">{one.status}</dt>
            <dd className="font-display text-3xl leading-tight font-extrabold">
              {countOf(one.status)}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
