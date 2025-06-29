interface ZoneContextInterface {
  updateCurrentAndRootZoneBundleId(bundleId: number | null): void;
  updateCurrentAndRootZoneParentTraceId(parentTraceId: number | null): void;
}

export default ZoneContextInterface;
