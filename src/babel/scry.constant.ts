//Marker for duplicate function
export const TRACE_MARKER = "__SCRY_MARK__";
//Marker for argument
export const ARGUMENT_MARKER = "__SCRY_ARG_MARK__";
//Event name for trace
export const TRACE_EVENT_NAME = "__SCRY_TRACE_EVENT_NAME__";
//Name for anonymous function
export const ANONYMOUS_FUNCTION_NAME = "__ANONYMOUS_FUNCTION__";
//Name for unknown location
export const UNKNOWN_LOCATION = "__UNKNOWN_LOCATION__";
//Name for development mode
export const DEVELOPMENT_MODE = "development";
//Name for trace zone
export const TRACE_ZONE = "__TRACE_ZONE__";
//Name for active trace id set(with zone.js)
export const ACTIVE_TRACE_ID_SET = "__ACTIVE_TRACE_ID_SET__";
//Name for active trace id set(with zone.js)
export const ACTIVE_TRACE_ID_MAP_WITH_BUNDLE_ID =
  "__ACTIVE_TRACE_ID_MAP_WITH_BUNDLE_ID__";
//Marker for parent trace id declare
export const PARENT_TRACE_ID_MARKER = "__PARENT_TRACE_ID_MARK__";
//Marker for origin code start
export const ORIGINAL_CODE_START_MARKER = "__ORIGINAL_CODE_START_MARK__";
//Marker for origin code end
export const ORIGINAL_CODE_END_MARKER = "__ORIGINAL_CODE_END_MARK__";

//Event type for trace event
export const ScryEventType = {
  enter: "enter",
  exit: "exit",
};

//Variable name for babel AST
export const ScryAstVariable = {
  traceId: "traceId",
  traceContext: "traceContext",
  //trace bundle id(when Tracer.start() is called, bundle id is generated)
  traceBundleId: "traceBundleId",
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
  //zone.js property
  _properties: "_properties",
};
