import { useEffect, useState } from 'react';
import type { Report, ReportRequest, ReportSource } from './report-source.js';

// Loads the Report for a request. An older Report is never shown for a newer request.
export function useReport(source: ReportSource, request: ReportRequest) {
  const requestKey = JSON.stringify(request);
  const [loaded, setLoaded] = useState<{ key: string; report: Report } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    source
      .load(JSON.parse(requestKey) as ReportRequest)
      .then((report) => {
        if (open) setLoaded({ key: requestKey, report });
      })
      .catch(() => {
        if (open) setFailedKey(requestKey);
      });
    return () => {
      open = false;
    };
  }, [source, requestKey]);

  return {
    report: loaded?.key === requestKey ? loaded.report : null,
    failed: failedKey === requestKey,
  };
}
