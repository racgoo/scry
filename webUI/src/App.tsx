import { useMemo, useState } from "react";
import { useInjectionData } from "./hooks/useInjectionData";
import { useInjectionMeta } from "./hooks/useInjectionMeta";
import { Header } from "./components/Header";
import { TraceList } from "./components/TraceList";
import { NodeDetailModal } from "./components/NodeDetailModal";
import type { TraceNode } from "./types/injection";
import "./App.css";

function App() {
  const { data } = useInjectionData();
  const { meta } = useInjectionMeta();
  const [selected, setSelected] = useState<TraceNode | null>(null);

  // Roots: nodes that are not children of any other node.  flatted
  // round-trips parent references, so we trust them when present.
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
          <div className="empty">
            No traced calls were recorded between{" "}
            <code>Tracer.start()</code> and <code>Tracer.end()</code>.
          </div>
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
