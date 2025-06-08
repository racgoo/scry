//ESM
import { Tracer } from "@racgoo/scry";
//CJS
// const { Tracer } = require("@racgoo/scry");

async function asyncTest2(flag) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}

function asyncTest1(flag) {
  console.log("asyncTest");
  asyncTest2(flag + ":hi").then((res) => {
    console.log(res);
    asyncTest2(flag + ":hi").then((res) => {
      console.log(res + "abc");
    });
  });
  return "hi";
}

function initTest() {
  Tracer.start();
  asyncTest1("1");
  Tracer.end();
}

initTest();
