import { downloadCurrentPage } from "../utils/download";

interface Props {
  description: string;
  startTimeISO: string;
  durationMs: number;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function Header({ description, startTimeISO, durationMs }: Props) {
  return (
    <header className="header">
      <div className="header-inner">
        <h1 className="title">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Scry Trace Results
        </h1>
        <p className="subtitle">
          Visualize your code's execution journey with precision and elegance
        </p>
        <p className="subtitle">
          The following output is displayed in a directory-like structure,
          representing the execution order of functions.
        </p>
        {description && (
          <p className="description">📝 <span>{description}</span></p>
        )}
        <div className="time-info">
          <span className="time-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            Started: {formatTime(startTimeISO)}
          </span>
          <span className="time-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Duration: {formatDuration(durationMs)}
          </span>
        </div>
        <div className="header-links">
          <a href="https://github.com/racgoo/scry" target="_blank" rel="noreferrer" className="header-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@racgoo/scry" target="_blank" rel="noreferrer" className="header-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 2.5h19v19h-19z" />
              <path d="M7.5 7.5v9h4.5v-9" />
              <path d="M16.5 7.5v9" />
            </svg>
            NPM
          </a>
          <button type="button" className="header-link" onClick={downloadCurrentPage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Download HTML
          </button>
        </div>
      </div>
    </header>
  );
}
