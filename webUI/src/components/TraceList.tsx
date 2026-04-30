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
        {/* L-shaped connector that ties this row to the parent guide line.
            Renders only when this <li> sits inside another .trace-list
            (CSS handles visibility via :not(:first-child)/etc).  The
            connector + the guide line on the parent <ul> form a clean
            tree that doesn't break when items wrap. */}
        <span className="tree-connector" aria-hidden="true" />
        <button
          type="button"
          className={`collapse-btn ${hasChildren ? "has-children" : "is-leaf"} ${
            open ? "is-open" : "is-collapsed"
          }`}
          onClick={() => hasChildren && setOpen((v) => !v)}
          aria-label={hasChildren ? (open ? "collapse" : "expand") : "leaf"}
          aria-expanded={hasChildren ? open : undefined}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            // Filled chevron — clearly visible, rotates when collapsed.
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          ) : (
            // Subtle dot for leaves — keeps the gutter aligned without
            // an empty-feeling slot.
            <svg
              width="6"
              height="6"
              viewBox="0 0 6 6"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="3" cy="3" r="2" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className={`trace-name-btn ${node.errored ? "errored" : ""}`}
          onClick={() => onSelect(node)}
        >
          <span className="trace-icon" aria-hidden="true">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span className="trace-name">{node.name || "(anonymous)"}</span>
          {hasChildren && (
            <span className="trace-count" title={`${node.children.length} child calls`}>
              {node.children.length}
            </span>
          )}
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
