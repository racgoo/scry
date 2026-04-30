import ZoneContextInterface from "./interface.js";

class ZoneContext implements ZoneContextInterface {
  /**
   * Update current and root zone state with bundle id
   * When Tracer.start() or Tracer.end() is called, Zone.current and Zone.root states are updated
   * Zone.current is used for function-level execution context, while Zone.root is used for file-level execution
   * This ensures that subsequent logic tracks based on the updated state
   */
  // Safely access or initialise _properties.traceContext on a Zone instance.
  // Zone.root._properties starts as {} — traceContext is injected by the babel
  // plugin at Program.enter, but Tracer.start() / Tracer.end() can be called
  // before any instrumented file runs (e.g. in test setup), so we must guard.
  private ensureTraceContext(zone: Zone) {
    const props = (zone as unknown as { _properties: Record<string, unknown> })
      ._properties;
    if (!props.traceContext) {
      props.traceContext = { traceBundleId: null, parentTraceId: null };
    }
    return props.traceContext as {
      traceBundleId: number | null;
      parentTraceId: number | null;
    };
  }

  public updateCurrentAndRootZoneBundleId(bundleId: number | null) {
    this.ensureTraceContext(Zone.current).traceBundleId = bundleId;
    this.ensureTraceContext(Zone.root).traceBundleId = bundleId;
  }

  public updateCurrentAndRootZoneParentTraceId(parentTraceId: number | null) {
    this.ensureTraceContext(Zone.current).parentTraceId = parentTraceId;
    this.ensureTraceContext(Zone.root).parentTraceId = parentTraceId;
  }
}

export default ZoneContext;
