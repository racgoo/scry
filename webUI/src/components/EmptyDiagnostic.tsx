import { useState } from "react";
import type { TraceNode } from "../types/injection";
import type { TraceMeta } from "../hooks/useInjectionMeta";

interface Props {
  data: TraceNode[];
  meta: TraceMeta;
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
export function EmptyDiagnostic({ data, meta }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const raw =
    typeof window !== "undefined" && typeof window.__INJECTION_DATA__ === "string"
      ? window.__INJECTION_DATA__
      : "(no __INJECTION_DATA__ on window)";

  // Lead with the runtime diagnostic counters — they pinpoint the failure
  // mode immediately:
  //   rawEventCount === 0 + listener=globalThis → emit & listener live on
  //     different globalThis objects (Vite prebundle quirk, fix:
  //     `optimizeDeps.exclude: ["@racgoo/scry"]`) OR no IIFE was generated
  //     at transform time (NODE_ENV=production / plugin not active).
  //   rawEventCount > 0 + droppedNullBundle === rawEventCount → IIFE ran
  //     but traceContext.traceBundleId stayed null (Tracer.start wasn't
  //     called inside the function or zone propagation broke).
  //   rawEventCount > 0 + droppedNullBundle < rawEventCount + tree empty →
  //     wrong bundleId (multiple Tracer.end races, etc).
  const r = meta.rawEventCount;
  const d = meta.droppedNullBundle;
  const tf = meta.transformedFiles;
  const verdict =
    r === undefined
      ? "Diagnostics not available (older runtime)."
      : tf === 0
      ? // DEFINITIVE: babel plugin counter is 0 ⇒ no user file was wrapped.
        'CONFIRMED: the scry babel plugin DID NOT RUN on any of your files (transformedFiles=0). Your vite.config is not wired correctly.\n\nFix:\n\n  import { scryVitePlugin } from "@racgoo/scry/vite";\n  import react from "@vitejs/plugin-react";\n  export default { plugins: [scryVitePlugin(), react()] };\n\nThen rm -rf node_modules/.vite and restart dev.'
      : r === 0 && (tf ?? 0) > 0
      ? `The babel plugin ran on ${tf} file(s), but the file calling Tracer.start/end isn't one of them. Either an \`exclude\` rule covers it, or Vite served it from a stale \`.vite/deps\` prebundle (try \`rm -rf node_modules/.vite\` and restart).`
      : r === 0
      ? "Listener never registered. The Tracer module probably never evaluated — make sure `@racgoo/scry` is actually imported somewhere."
      : r > 0 && d === r
      ? "Listener heard events but every one had traceBundleId=null. Tracer.start() likely wasn't called in the same execution path, or zone propagation broke."
      : `Listener heard ${r} events (${(d ?? 0)} rejected) but the bundle for this Tracer.end() got 0. The trace landed in a different bundleId — possible race with another Tracer.start/end pair.`;

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
      <div
        style={{
          marginTop: "1.25rem",
          padding: "0.85rem 1rem",
          background: "rgba(var(--primary-rgb), 0.08)",
          border: "1px solid rgba(var(--primary-rgb), 0.3)",
          borderRadius: "10px",
          textAlign: "left",
          maxWidth: "640px",
          marginLeft: "auto",
          marginRight: "auto",
          fontSize: "0.85rem",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: "var(--primary-light)" }}>
          Verdict
        </p>
        <pre
          style={{
            margin: "0.4rem 0 0 0",
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          {verdict}
        </pre>
        <p
          style={{
            margin: "0.6rem 0 0 0",
            color: "var(--text-secondary)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.75rem",
          }}
        >
          data.length=<strong>{data.length}</strong>
          {" · "}transformedFiles=<strong>{tf ?? "?"}</strong>
          {" · "}rawEvents=<strong>{r ?? "?"}</strong>
          {" · "}droppedNullBundle=<strong>{d ?? "?"}</strong>
          {" · "}listener=<strong>{meta.listenerKind ?? "?"}</strong>
          {" · "}pluginApplied=<strong>{String(meta.pluginApplied ?? "?")}</strong>
        </p>
      </div>
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
