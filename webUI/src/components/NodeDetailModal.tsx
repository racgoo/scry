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
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="close"
        >
          ✕
        </button>
        <header className="detail-header">
          <div className="detail-title-row">
            <h2 className="function-name">
              <span className="function-name-icon">ƒ</span>
              {node.name || "(anonymous)"}
            </h2>
            <div className="meta-badges">
              <span className="badge call-type">{callType}</span>
              <span className={`badge ${node.errored ? "fail" : "ok"}`}>
                {node.errored ? "Failed" : "Success"}
              </span>
              {node.chained && <span className="badge">chained</span>}
              {!node.completed && <span className="badge warn">pending</span>}
            </div>
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
