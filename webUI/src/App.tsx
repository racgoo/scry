import { useMemo, useState } from "react";
import { useInjectionData } from "./hooks/useInjectionData";
import { useInjectionMeta } from "./hooks/useInjectionMeta";
import { Header } from "./components/Header";
import { TraceList } from "./components/TraceList";
import { NodeDetailModal } from "./components/NodeDetailModal";
import { EmptyDiagnostic } from "./components/EmptyDiagnostic";
import { BundleTabs } from "./components/BundleTabs";
import type { TraceNode } from "./types/injection";
import "./App.css";

function App() {
  const { data } = useInjectionData();
  const { meta } = useInjectionMeta();
  const [selected, setSelected] = useState<TraceNode | null>(null);
  // When meta.bundles has multiple entries (back-to-back Tracer.start/end
  // pairs batched into one report), let the user flip between them.  The
  // last bundle is the default — that's the data primary __INJECTION_DATA__
  // already holds.
  const allBundles = meta.bundles ?? [];
  const lastBundleId =
    allBundles.length > 0 ? allBundles[allBundles.length - 1].id : null;
  const [activeBundleId, setActiveBundleId] = useState<number | null>(
    lastBundleId
  );

  const activeBundle = useMemo(() => {
    if (allBundles.length === 0) return null;
    const id = activeBundleId ?? lastBundleId;
    return allBundles.find((b) => b.id === id) ?? allBundles[allBundles.length - 1];
  }, [allBundles, activeBundleId, lastBundleId]);

  // Roots: prefer the active bundle's nodes when available, otherwise fall
  // back to the primary __INJECTION_DATA__ payload.
  const roots = useMemo<TraceNode[]>(() => {
    const source = activeBundle ? activeBundle.nodes : data;
    const haveParent = source.some((n) => n.parent);
    return haveParent ? source.filter((n) => !n.parent) : source;
  }, [activeBundle, data]);

  // Header reflects the active bundle when one is selected so the time/
  // duration/description match the tree on screen.
  const headerMeta = activeBundle
    ? {
        description: activeBundle.description,
        startTimeISO: activeBundle.startTimeISO,
        durationMs: activeBundle.durationMs,
      }
    : {
        description: meta.description,
        startTimeISO: meta.startTimeISO,
        durationMs: meta.durationMs,
      };

  return (
    <div className="app">
      <Header
        description={headerMeta.description}
        startTimeISO={headerMeta.startTimeISO}
        durationMs={headerMeta.durationMs}
      />
      {allBundles.length > 1 && (
        <BundleTabs
          bundles={allBundles}
          activeId={activeBundle?.id ?? null}
          onSelect={setActiveBundleId}
        />
      )}
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
