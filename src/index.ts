import * as GlobalTracer from "./tracer/tracer.js";
import {
  scryBabelPluginForCJS,
  scryBabelPluginForESM,
} from "./babel/scry-babel-plugin.js";
import Extractor from "./utils/extractor.js";
const Tracer = new GlobalTracer.default();

export { Tracer, scryBabelPluginForCJS, scryBabelPluginForESM, Extractor };
