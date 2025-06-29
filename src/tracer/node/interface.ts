import { TraceDetail } from "../record";
import { TraceNode } from "./type.js";

interface NodeGeneratorInterface {
  generateNodesWithTraceDetails(details: TraceDetail[]): TraceNode[];
}

export { NodeGeneratorInterface };
