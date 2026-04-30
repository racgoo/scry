import { useMemo, useState } from "react";
import { useInjectionData } from "./hooks/useInjectionData";
import { useInjectionMeta } from "./hooks/useInjectionMeta";
import { Header } from "./components/Header";
import { TraceList } from "./components/TraceList";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { EmptyDiagnostic } from "./components/EmptyDiagnostic";
import type { TraceNode } from "./types/injection";
import "./App.css";

function App() {
  const { data } = useInjectionData();
  const { meta } = useInjectionMeta();
  const [selected, setSelected] = useState<TraceNode | null>(null);

  // Tracer.end() already feeds us a list of roots (the node generator only
  // pushes nodes whose parentTraceId can't be resolved into the result).
  // We still defensively filter in case future code paths inject the full
  // tree — flatted round-trips parent refs, so this stays correct.
  const roots = useMemo(() => {
    const haveParent = data.some((n) => n.parent);
    return haveParent ? data.filter((n) => !n.parent) : data;
  }, [data]);

  return (
    <div className="app">
      <Header
        description={meta.description}
        startTimeISO={meta.startTimeISO}
        durationMs={meta.durationMs}
      />
      <main className="main">
        {roots.length === 0 ? (
          <EmptyDiagnostic data={data} meta={meta} />
        ) : (
          <TraceList nodes={roots} onSelect={setSelected} />
        )}
      </main>
      {selected && (
        <NodeDetailModal node={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default App;
