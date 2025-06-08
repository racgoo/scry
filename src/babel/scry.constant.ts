//Marker for duplicate function
export const TRACE_MARKER = "__SCRY_MARK__";
//Marker for argument
export const ARGUMENT_MARKER = "__SCRY_ARG_MARK__";
//Event name for trace
export const TRACE_EVENT_NAME = "scry:trace";
//Name for anonymous function
export const ANONYMOUS_FUNCTION_NAME = "AnonymousFunction";
//Name for unknown location
export const UNKNOWN_LOCATION = "UnknownLocation";
//Name for development mode
export const DEVELOPMENT_MODE = "development";
//Name for trace zone
export const TRACE_ZONE = "TraceZone";
//Name for active trace id set(with zone.js)
export const ACTIVE_TRACE_ID_SET = "ActiveTraceIdSet";

//Event type for trace event
export const ScryEventType = {
  enter: "enter",
  exit: "exit",
};

//Variable name for babel AST
export const ScryAstVariable = {
  traceId: "traceId",
  parentTraceId: "parentTraceId",
  returnValue: "returnValue",
  args: "args",
  //Call path in source code
  source: "source",
  type: "type",
  name: "name",
  //Chained function
  chained: "chained",
  globalThis: "globalThis",
  //GlobalCallCounter for auto-increment( UUID generation is big resource usage )
  globalScryCalledCount: "__globalScryCalledCount",
  globalParentTraceId: "__globalParentTraceId",
  //Column name for under codes
  code: "code",
  functionCode: "functionCode",
  classCode: "classCode",
  methodCode: "methodCode",
};
