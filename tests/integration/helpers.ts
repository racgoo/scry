import Tracer from "../../src/tracer/tracer.js";
import { NodeGenerator } from "../../src/tracer/node/nodeGenerator.js";
import type { TraceNode } from "../../src/tracer/node/type.js";

/**
 * Run `fn` inside a Tracer session and return the resulting TraceNode tree.
 *
 * @param fn      The code-under-test (should be already-instrumented via the
 *                scry babel plugin applied to .fixture.ts files).
 * @param timeout How long to wait for async traces before giving up (ms).
 */
export async function traceRun(
  fn: () => Promise<void> | void,
  timeout = 5000
): Promise<TraceNode[]> {
  const tracer = new Tracer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = (tracer as any).recorder;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts = (tracer as any).currentOption;

  tracer.start("test-run");

  try {
    await fn();
  } catch {
    // Intentional: some fixtures intentionally throw – we still want the tree
  }

  const bundleId: number = opts.traceBundleId;
  // Wait for all async done-events (or timeout)
  await rec.waitAllContextDone(bundleId, timeout);

  const bundle = rec.getBundleMap().get(bundleId);
  if (!bundle) return [];

  const generator = new NodeGenerator();
  return generator.generateNodesWithTraceDetails(bundle.details);
}

/** Flat list of all node names in depth-first order (for quick assertions). */
export function nodeNames(nodes: TraceNode[]): string[] {
  const names: string[] = [];
  function walk(list: TraceNode[]) {
    for (const n of list) {
      names.push(n.name);
      walk(n.children);
    }
  }
  walk(nodes);
  return names;
}

/** Find a node anywhere in the tree by name. */
export function findNode(
  nodes: TraceNode[],
  name: string
): TraceNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const found = findNode(n.children, name);
    if (found) return found;
  }
  return undefined;
}
