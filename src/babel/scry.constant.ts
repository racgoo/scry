export const TRACE_MARKER = "__SCRY_MARK__";
export const ARGUMENT_MARKER = "__SCRY_ARG_MARK__";
export const TRACE_EVENT_NAME = "scry:trace";
export const ANONYMOUS_FUNCTION_NAME = "AnonymousFunction";
export const UNKNOWN_LOCATION = "UnknownLocation";
export const DEVELOPMENT_MODE = "development";
export const TRACE_ZONE = "_traceZone";

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
  chained: "chained",
  globalThis: "globalThis",
  globalScryCalledCount: "__globalScryCalledCount",
  globalCurrentTraceId: "__globalCurrentTraceId",
  globalParentTraceId: "__globalParentTraceId",
  code: "code",
  functionCode: "functionCode",
  classCode: "classCode",
  methodCode: "methodCode",
};
