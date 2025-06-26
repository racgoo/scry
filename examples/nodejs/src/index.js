//ESM
import { Tracer } from "@racgoo/scry";
import { classTest, asyncTest, syncTest } from "./mjs-test.js";
//CJS
// const { Tracer } = require("@racgoo/scry");
// const { classTest, asyncTest, syncTest } = require("./cjs-test.js");

Tracer.start();

asyncTest();
syncTest();
classTest();
Tracer.end();
