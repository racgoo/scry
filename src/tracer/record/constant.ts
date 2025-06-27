/**
 * Event constant for trace context.
 * "enter": context is entering a function
 * "exit": context is exiting a function
 * "done": context is done(Promise or Object, etc)
 */
const TraceEvent = {
  ENTER: "enter",
  EXIT: "exit",
  DONE: "done",
} as const;

export { TraceEvent };
