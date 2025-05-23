import * as GlobalTracer from "@tracer/tracer";
import scryBabelPlugin from "@babel/scry-babel-plugin";

const Tracer = new GlobalTracer.default();

export { Tracer, scryBabelPlugin };
