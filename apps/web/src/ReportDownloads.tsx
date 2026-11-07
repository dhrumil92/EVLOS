import type { PoojaStatusName, ReportRequest, ReportSource } from './report-source.js';

export function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
    </svg>
  );
}

// Excel and CSV of one Report. Each press downloads at once; `status` keeps only the Students
// with that Pooja Status on at least one Day, or All.
export function ReportDownloads(props: {
  label: string;
  source: ReportSource;
  request: ReportRequest;
  status: PoojaStatusName | 'All';
}) {
  const { source, request, status } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className="btn inline-flex items-center gap-2 pt-2.5"
        href={source.xlsxUrl(request, status)}
        aria-label={`Download ${props.label} as Excel`}
        download
      >
        <DownloadIcon />
        Excel
      </a>
      <a
        className="btn-quiet inline-flex items-center gap-2 pt-2.5"
        href={source.csvUrl(request, status)}
        aria-label={`Download ${props.label} as CSV`}
        download
      >
        <DownloadIcon />
        CSV
      </a>
    </div>
  );
}
