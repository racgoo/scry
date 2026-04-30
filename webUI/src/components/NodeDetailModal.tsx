import { useEffect } from "react";
import type { TraceNode } from "../types/injection";

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
          // Common noise to suppress: Zone, Promises, Errors stay readable
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
    node.methodCode || node.functionCode || "Source code not available";

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
          <h2 className="function-name">{node.name || "(anonymous)"}</h2>
          <div className="meta-badges">
            <span className="badge call-type">{callType}</span>
            <span className={`badge ${node.errored ? "fail" : "ok"}`}>
              {node.errored ? "Failed" : "Success"}
            </span>
            {node.chained && <span className="badge">chained</span>}
            {!node.completed && <span className="badge warn">pending</span>}
          </div>
        </header>

        <Section
          title={callType === "method" ? "Method Definition" : "Function Definition"}
        >
          <pre>
            <code>{definition}</code>
          </pre>
        </Section>

        {node.classCode && (
          <Section title="Class Definition">
            <pre>
              <code>{node.classCode}</code>
            </pre>
          </Section>
        )}

        <Section title="Arguments">
          <pre>
            <code>{safeStringify(node.args)}</code>
          </pre>
        </Section>

        <Section title="Return Value">
          <pre>
            <code>{safeStringify(node.returnValue)}</code>
          </pre>
        </Section>

        <Section title="Source Location">
          <span className="source-badge">{node.source || "unknown"}</span>
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
