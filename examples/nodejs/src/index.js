//ESM
import { Tracer } from "@racgoo/scry";
import { classTest, asyncTest, syncTest } from "./mjs-test.js";
//CJS
// const { Tracer } = require("@racgoo/scry");
// const { classTest, asyncTest, syncTest } = require("./cjs-test.js");

async function test() {
  Tracer.start("First");
  syncTest();
  classTest();
  Tracer.end();
  Tracer.start("Second");
  await asyncTest();
  Tracer.end();
}
test();
