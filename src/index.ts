import * as GlobalTracer from "./tracer/tracer.js";
import scryBabelPlugin from "./babel/scry-babel-plugin.js";
const Tracer = new GlobalTracer.default();
// // tracer,
export { Tracer, scryBabelPlugin };
