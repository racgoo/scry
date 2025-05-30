export const TRACE_MARKER = "__SCRY_MARK__";
export const TRACE_EVENT_NAME = "scry:trace";
export const ANONYMOUS_FUNCTION_NAME = "AnonymousFunction";
export const UNKNOWN_LOCATION = "UnknownLocation";
export const DEVELOPMENT_MODE = "development";

export const ScryEventType = {
  enter: "enter",
  exit: "exit",
};

export const ScryAstVariable = {
  traceId: "traceId",
  parentTraceId: "parentTraceId",
  returnValue: "returnValue",
  args: "args",
  source: "source",
  type: "type",
  name: "name",
  originCode: "originCode",
  classCode: "classCode",
  chained: "chained",
  globalThis: "globalThis",
  globalScryCalledCount: "__globalScryCalledCount",
  globalCurrentTraceId: "__globalCurrentTraceId",
  globalParentTraceId: "__globalParentTraceId",
};
