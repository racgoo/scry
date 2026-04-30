// Tab strip shown when Tracer.end() captured more than one bundle within
// the export-debounce window (back-to-back Tracer.start/end pairs).  Lets
// the user flip between the trace trees without us needing to open
// multiple browser tabs.
import type { ReportBundle } from "../hooks/useInjectionMeta";

interface Props {
  bundles: ReportBundle[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function totalNodes(nodes: ReportBundle["nodes"]): number {
  let n = 0;
  const walk = (list: ReportBundle["nodes"]) => {
    for (const node of list) {
      n++;
      walk(node.children ?? []);
    }
  };
  walk(nodes);
  return n;
}

export function BundleTabs({ bundles, activeId, onSelect }: Props) {
  return (
    <nav className="bundle-tabs" role="tablist" aria-label="Trace bundles">
      <span className="bundle-tabs-label">Bundles</span>
      <div className="bundle-tabs-scroll">
        {bundles.map((b, i) => {
          const isActive = b.id === activeId;
          const count = totalNodes(b.nodes);
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`bundle-tab ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(b.id)}
              title={`Started ${formatTime(b.startTimeISO)} · ${formatDuration(
                b.durationMs
              )} · ${count} calls`}
            >
              <span className="bundle-tab-index">#{i + 1}</span>
              <span className="bundle-tab-name">
                {b.description || "(unnamed)"}
              </span>
              <span className="bundle-tab-count">{count}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
