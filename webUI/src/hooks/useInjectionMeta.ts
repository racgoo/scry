import { useLayoutEffect, useState } from "react";
import * as flatted from "flatted";
import { decode } from "js-base64";
import type { TraceNode } from "../types/injection";

export interface ReportBundle {
  id: number;
  description: string;
  startTimeISO: string;
  durationMs: number;
  nodes: TraceNode[];
}

interface RawInjectionBundle {
  id: number;
  description: string;
  startTimeISO: string;
  durationMs: number;
  nodesSerialized: string;
}

export interface TraceMeta {
  description: string;
  startTimeISO: string;
  durationMs: number;
  rawEventCount?: number;
  droppedNullBundle?: number;
  listenerKind?: "process" | "globalThis" | "none";
  pluginApplied?: boolean;
  transformedFiles?: number;
  bundles?: ReportBundle[];
}

const FALLBACK: TraceMeta = {
  description: "",
  startTimeISO: new Date().toISOString(),
  durationMs: 0,
};

function deserializeBundles(
  raw: RawInjectionBundle[] | undefined
): ReportBundle[] | undefined {
  if (!raw) return undefined;
  return raw.map((b) => ({
    id: b.id,
    description: b.description,
    startTimeISO: b.startTimeISO,
    durationMs: b.durationMs,
    // Each bundle ships its tree as a base64-encoded flatted string —
    // mirrors the primary __INJECTION_DATA__ encoding because the trees
    // contain cyclic parent/children refs.
    nodes: flatted.parse(decode(b.nodesSerialized)) as TraceNode[],
  }));
}

export function useInjectionMeta() {
  const [meta, setMeta] = useState<TraceMeta>(FALLBACK);
  useLayoutEffect(() => {
    const w = window as unknown as {
      __INJECTION_META__?: TraceMeta;
      __INJECTION_BUNDLES__?: RawInjectionBundle[];
    };
    const injected = w.__INJECTION_META__;
    if (!injected) return;
    const next: TraceMeta = { ...injected };
    if (w.__INJECTION_BUNDLES__) {
      try {
        next.bundles = deserializeBundles(w.__INJECTION_BUNDLES__);
      } catch (e) {
        console.error("[scry] failed to decode bundles:", e);
      }
    }
    setMeta(next);
  }, []);
  return { meta };
}
