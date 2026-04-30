import { useState } from "react";
import type { TraceNode } from "../types/injection";

interface Props {
  data: TraceNode[];
}

// Shown when Tracer.end() produced zero root trace nodes.  Surfaces the raw
// injection so users can self-diagnose instead of staring at a vague
// "nothing recorded" message — there are several distinct failure modes:
//
//   • Tracer.start/end window contained no instrumented calls (e.g. wrong
//     NODE_ENV, plugin not actually transforming the file).
//   • The traced function was never invoked while the window was open
//     (e.g. probabilistic spawn that never fired in a short session).
//   • Vite served a stale .vite/deps prebundle that doesn't include the
//     latest scry runtime listener — emits dispatched but were never heard.
//   • The bundler tree-shook the side-effect import and the recorder
//     never registered (despite our package.json sideEffects allow-list).
export function EmptyDiagnostic({ data }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const raw =
    typeof window !== "undefined" && typeof window.__INJECTION_DATA__ === "string"
      ? window.__INJECTION_DATA__
      : "(no __INJECTION_DATA__ on window)";
  const meta =
    typeof window !== "undefined" && (window as unknown as { __INJECTION_META__?: unknown }).__INJECTION_META__;

  return (
    <div className="empty">
      <p>
        No traced calls were recorded between <code>Tracer.start()</code>{" "}
        and <code>Tracer.end()</code>.
      </p>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Common causes:
      </p>
      <ul style={{ textAlign: "left", maxWidth: "640px", margin: "0.5rem auto", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        <li>
          The traced body had no instrumented call sites — e.g. only{" "}
          <code>const</code> assignments and literals between{" "}
          <code>start</code> and <code>end</code>.
        </li>
        <li>
          The traced function (or this code path) wasn't invoked during the
          window — common for probabilistic branches like{" "}
          <code>{"if (Math.random() < 0.03) spawn()"}</code>.
        </li>
        <li>
          <code>NODE_ENV</code> was not <code>"development"</code> when the
          plugin transformed the file — instrumentation is gated on it.
        </li>
        <li>
          Vite served a stale{" "}
          <code>node_modules/.vite/deps</code> prebundle. Try{" "}
          <code>rm -rf node_modules/.vite</code> and restart dev.
        </li>
      </ul>
      <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        Diagnostic — <code>data.length</code>: <strong>{data.length}</strong>
        {" · "}
        meta:{" "}
        <strong>{meta ? "present" : "missing"}</strong>
      </p>
      <button
        type="button"
        className="header-link"
        style={{ marginTop: "0.75rem" }}
        onClick={() => setShowRaw((v) => !v)}
      >
        {showRaw ? "Hide" : "Show"} raw __INJECTION_DATA__
      </button>
      {showRaw && (
        <pre
          style={{
            marginTop: "0.75rem",
            textAlign: "left",
            maxWidth: "100%",
            overflow: "auto",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--card-border)",
            borderRadius: "10px",
            padding: "0.85rem 1rem",
            fontSize: "0.75rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {raw.length > 4000 ? raw.slice(0, 4000) + "\n…(truncated)" : raw}
        </pre>
      )}
    </div>
  );
}
