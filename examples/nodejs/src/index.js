//ESM
import { Tracer } from "@racgoo/scry";
//CJS
// const { Tracer } = require("@racgoo/scry");

async function asyncTest1(flag) {
  console.log("asyncTest", flag);
  await asyncTest2(flag + ":await1");
  asyncTest2(flag + ":then1").then((res) => {
    console.log(res);
  });
  await asyncTest2(flag + ":await2");
  console.log("alldone");
  return flag + "bye..";
}

async function asyncTest2(flag) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}

async function asyncTest() {
  asyncTest1("then1").then((res) => {
    console.log(res);
  });
  await asyncTest1("await1");
  asyncTest1("then2").then((res) => {
    console.log(res);
  });
  await asyncTest1("await2");
}

const syncTest1 = () => {
  console.log("syncTest1");
};
const syncTest2 = () => {
  console.log("syncTest2");
};

const syncTest = () => {
  syncTest1();
  syncTest2();
};

Tracer.start();
asyncTest();
syncTest();
Tracer.end();
