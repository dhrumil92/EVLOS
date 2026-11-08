import { useState } from 'react';
import { MonthReport } from './MonthReport.js';
import { requestFor, startPicks, withPick } from './report-month.js';
import type { PeriodKey } from './report-month.js';
import type { ReportSource } from './report-source.js';
import { StudentsInMonth } from './StudentsInMonth.js';
import { useReport } from './use-report.js';

// The Reports page: this month, with nothing to press first. The Rector can pick a Day, a
// Month or a range of dates. Every download is one press; the period and the
// rows only change what the page and the downloads hold.
export function ReportsPage(props: { source: ReportSource; today: string }) {
  const { source, today } = props;
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [picks, setPicks] = useState(() => startPicks(today));
  const request = requestFor(period, picks);
  const { report, failed } = useReport(source, request);
  return (
    <div className="grid gap-5">
      <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
        Reports
      </h1>
      <MonthReport
        source={source}
        report={report}
        failed={failed}
        request={request}
        today={today}
        period={period}
        onPeriod={setPeriod}
        picks={picks}
        onPick={(name, value) => {
          setPicks((old) => withPick(old, name, value));
        }}
      />
      {report && <StudentsInMonth report={report} />}
    </div>
  );
}
