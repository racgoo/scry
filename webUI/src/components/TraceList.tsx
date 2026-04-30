import { useState } from "react";
import type { TraceNode } from "../types/injection";

interface Props {
  nodes: TraceNode[];
  onSelect: (node: TraceNode) => void;
}

export function TraceList({ nodes, onSelect }: Props) {
  return (
    <ul className="trace-list">
      {nodes.map((node) => (
        <TraceItem key={node.traceId} node={node} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function TraceItem({
  node,
  onSelect,
}: {
  node: TraceNode;
  onSelect: (n: TraceNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className="trace-item">
      <div className="trace-row">
        <button
          type="button"
          className={`collapse-btn ${hasChildren ? "" : "invisible"} ${open ? "" : "collapsed"}`}
          onClick={() => hasChildren && setOpen((v) => !v)}
          aria-label={hasChildren ? (open ? "collapse" : "expand") : ""}
          tabIndex={hasChildren ? 0 : -1}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          className={`trace-name-btn ${node.errored ? "errored" : ""}`}
          onClick={() => onSelect(node)}
        >
          <span className="trace-icon">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span className="trace-name">{node.name || "(anonymous)"}</span>
          {node.chained && <span className="chip">chained</span>}
          {!node.completed && <span className="chip warn">pending</span>}
          {node.errored && <span className="chip err">error</span>}
        </button>
      </div>
      {hasChildren && open && (
        <TraceList nodes={node.children} onSelect={onSelect} />
      )}
    </li>
  );
}
