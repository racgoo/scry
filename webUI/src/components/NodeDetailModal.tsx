import { useEffect } from "react";
import type { TraceNode } from "../types/injection";
import { CodeBlock } from "./CodeBlock";

interface Props {
  node: TraceNode;
  onClose: () => void;
}

function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
          const ctor = (v as { constructor?: { name?: string } }).constructor;
          if (ctor?.name?.includes("Zone")) return "[Zone]";
          if (v instanceof Error) return v.stack || v.message;
          if (v instanceof Promise) return "[Promise]";
        }
        return v;
      },
      indent
    );
  } catch {
    return "[Unstringifiable]";
  }
}

export function NodeDetailModal({ node, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const callType = node.classCode ? "method" : "function";
  const definition =
    node.methodCode || node.functionCode || "// Source code not available";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky toolbar — keeps the close button visible while the modal
            scrolls and never overlaps the title row.  All meta moves
            below it instead of fighting for the same corner. */}
        <div className="modal-toolbar">
          <div className="modal-toolbar-spacer" />
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="close"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>
        <header className="detail-header">
          <h2 className="function-name">
            <span className="function-name-icon" aria-hidden="true">ƒ</span>
            <span className="function-name-text">{node.name || "(anonymous)"}</span>
          </h2>
          <div className="meta-badges">
            <span className="badge call-type">{callType}</span>
            <span className={`badge ${node.errored ? "fail" : "ok"}`}>
              {node.errored ? "Failed" : "Success"}
            </span>
            {node.chained && <span className="badge">chained</span>}
            {!node.completed && <span className="badge warn">pending</span>}
          </div>
          {node.source && (
            <div className="source-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <code>{node.source}</code>
            </div>
          )}
        </header>

        <Section
          title={callType === "method" ? "Method Definition" : "Function Definition"}
        >
          <CodeBlock code={definition} language="tsx" />
        </Section>

        {node.classCode && (
          <Section title="Class Definition">
            <CodeBlock code={node.classCode} language="tsx" />
          </Section>
        )}

        <Section title="Arguments">
          <CodeBlock code={safeStringify(node.args)} language="json" />
        </Section>

        <Section title="Return Value">
          <CodeBlock code={safeStringify(node.returnValue)} language="json" />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <h3 className="section-title">{title}</h3>
      <div className="section-content">{children}</div>
    </section>
  );
}
