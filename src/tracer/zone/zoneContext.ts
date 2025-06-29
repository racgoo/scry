import ZoneContextInterface from "./interface.js";

class ZoneContext implements ZoneContextInterface {
  /**
   * Update current and root zone state with bundle id
   * When Tracer.start() or Tracer.end() is called, Zone.current and Zone.root states are updated
   * Zone.current is used for function-level execution context, while Zone.root is used for file-level execution
   * This ensures that subsequent logic tracks based on the updated state
   */
  public updateCurrentAndRootZoneBundleId(bundleId: number | null) {
    //Update current zone state
    (
      Zone.current as unknown as {
        _properties: { traceContext: { traceBundleId: number | null } };
      }
    )._properties.traceContext.traceBundleId = bundleId;
    //Update root zone state
    (
      Zone.root as unknown as {
        _properties: { traceContext: { traceBundleId: number | null } };
      }
    )._properties.traceContext.traceBundleId = bundleId;
  }

  public updateCurrentAndRootZoneParentTraceId(parentTraceId: number | null) {
    //Update current zone state
    (
      Zone.current as unknown as {
        _properties: { traceContext: { parentTraceId: number | null } };
      }
    )._properties.traceContext.parentTraceId = parentTraceId;
    //Update root zone state
    (
      Zone.root as unknown as {
        _properties: { traceContext: { parentTraceId: number | null } };
      }
    )._properties.traceContext.parentTraceId = parentTraceId;
  }
}

export default ZoneContext;
