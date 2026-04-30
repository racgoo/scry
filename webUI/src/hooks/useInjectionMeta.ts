import { useLayoutEffect, useState } from "react";

export interface TraceMeta {
  description: string;
  startTimeISO: string;
  durationMs: number;
}

const FALLBACK: TraceMeta = {
  description: "",
  startTimeISO: new Date().toISOString(),
  durationMs: 0,
};

export function useInjectionMeta() {
  const [meta, setMeta] = useState<TraceMeta>(FALLBACK);
  useLayoutEffect(() => {
    const injected = (window as unknown as { __INJECTION_META__?: TraceMeta })
      .__INJECTION_META__;
    if (injected) setMeta(injected);
  }, []);
  return { meta };
}
